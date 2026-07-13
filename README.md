# Profit Taker

An autonomous profit-taking agent on X Layer. It watches a position, sells in
planned increments as price climbs, protects gains on the way down, and writes
every realized sale into a double-entry ledger with an onchain receipt.

Deployed and running on X Layer testnet (chain 1952).

---

## The architecture

Three contracts, one job each. The separation is the point.

**BRAIN** — the policy engine. Reads an oracle, compares price to cost basis,
and emits a signed *intent*: what to sell, how much, and why. It decides. It
never touches funds.

**HANDS** — the executor. Consumes an intent and fills it. It executes. It never
re-decides. Slippage bounds come from the intent, not from a live quote.

**BOOKS** — the ledger. Records what actually happened, at the price actually
filled. It records. It never trusts the caller.

BRAIN ──intent──▶ HANDS ──receipt──▶ BOOKS
│                                    │
└── policy                           └── Dr / Cr / Realized Gain

---

## The two problems this solves

Most "profit taker" bots have the same two bugs.

### 1. Chop re-fires the same exit

Naive design: *"sell 25% whenever gain > 20%."* Price hits +25%, sells. Falls to
+5%. Climbs to +26%. **Sells again** — because gain is still measured against the
original entry. On a choppy market it bleeds the position out on the same signal,
over and over. A cooldown timer only hides this.

**Fix: a ratcheting ladder.** Exits are rungs, not a repeating threshold:

| Rung | Trigger | Sells |
|------|---------|-------|
| 0    | +20%    | 25%   |
| 1    | +50%    | 25%   |
| 2    | +100%   | 50%   |

`rungsFired` only increments. Once rung 0 fires, it's spent forever. Price can
swing back through +20% a hundred times — the next unfired rung is at +50%, and
nothing else can trigger. **The ladder ratchets one direction.**

One subtlety: `sellBps` is a percentage of *original* units, not remaining. If it
were remaining, four 25% rungs would sell 25%, then 25% of the leftover 75%, then
25% of that — you'd asymptotically approach zero and never actually exit. As
written, 25+25+50 = 100% of the original position, and `setPosition` rejects any
ladder summing over 100%.

### 2. It rides a winner all the way back down

The ladder handles the climb. It does nothing when price peaks between rungs and
collapses.

**Fix: a trailing stop from peak.** `peakPrice` ratchets up on every keeper poll.
If price gives back `trailBps` from that high-water mark **while still above
basis**, the position fully exits.

This is not a stop-loss. It fires *in profit* — it protects a gain rather than
capping a loss.

Trail is checked before rungs. If price spikes past three rungs and then crashes
in a single block, you get one clean TRAIL exit, not three sequential rung fires
into a falling market.

---

## Accounting

BOOKS records the **fill**, not the intent.

BRAIN says sell at $125,000. HANDS fills at $124,375 after slippage. The ledger
records $124,375 — because accounting records what happened, not what was
planned. This is why `post()` takes `priceOut` as a parameter instead of reading
the oracle itself.

A real entry from testnet:

Dr  USDC                  $31,093.75
Cr  BTC (basis)           $25,000.00
Cr  Realized Gain          $6,093.75
Receipt: 0x6ed1944a8583196dac2b443131a2bffd4e47399dc130fbcb46306802c005a708

`isBalanced(entryId)` proves `proceeds == basis + pnl` onchain for any entry.

`realizedPnlUsd` is `int256`, not `uint256`. A TRAIL exit can still be a loss if
a position ran up and then collapsed below basis. **A ledger that cannot record a
loss is not a ledger.**

### What a balanced ledger does not prove

During development, an entry posted with a cost basis 1000× too low. `isBalanced`
returned `true` — because the invariant `proceeds == basis + pnl` holds
arithmetically even when the inputs are garbage.

The fix was structural, not arithmetic. **HANDS now reads `basisPerUnit` from
BRAIN's storage instead of accepting it as a parameter.** No caller — including a
buggy keeper — can misstate cost basis. A `settled[intentNonce]` mapping also
makes double-posting impossible on a keeper retry.

Entry #0 in the deployed ledger is that bad entry. It's left in deliberately.

---

## The keeper

`keeper.js` polls `check()` on each token every 15 seconds. When a rung or trail
arms, it fires the intent, settles it through HANDS, and reads back the ledger —
unattended.

It also swallows `"no trigger"` reverts silently. That's not just error handling:
polling `fire()` is what keeps `peakPrice` current, which is what makes the
trailing stop work. **A trailing stop is only as fresh as its last poll.**

[11:38:31] BTC  $100,000.00  0.00%  — idle
[11:38:46] BTC  $125,000.00  25.00%  → RUNG TRIGGERED
intent #1  0x3c6233056119c668a0c4066362658ca965bd68dcb45637ca89ee512e901d746d
settled    0x3ab44cee9771ca5a29dfc86491c76763ef10f42db8672dd5bdc2ed5fcd84bbf6
books: Dr $31,093.75 | Cr basis $25,000.00 | Cr gain $6,093.75
[11:39:01] BTC  $125,000.00  25.00%  — idle

Note the last line. Price is still +25%, above rung 0's trigger — and the agent
is **idle**. The ratchet holds under live polling, not just in a unit test.

---

## Deployed — X Layer testnet (1952)

| Contract | Address |
|----------|---------|
| BRAIN    | `0x616528A1eAD18e8ceD9B500145190cdbd08eA580` |
| BOOKS    | `0x339BCF5feCfdbDb8186F5531DaE67f8C4ae6d54c` |
| HANDS    | `0xCefEF8e85a19e984fb4267C475580847ade31EF6` |
| BTC feed | `0xFC4098a491A3609C4D8cAe3Aa38Dc55e953b3d6a` |
| ETH feed | `0x4ACdEA384c1aD24CB387a22a81cbD416e277BA88` |

---

## Honest scope

**The oracle is mocked.** X Layer's documented Chainlink-compatible feed
addresses did not resolve to deployed contracts on either testnet or mainnet at
build time. `MockAggregator` implements the exact `AggregatorV3Interface` that
BRAIN consumes — swapping in a real feed is a one-line config change and zero
code change.

This is also the better demo. A live BTC feed cannot show you a ladder, because
BTC will not move 20% during a two-minute video. The mock drives price up through
two rungs and then crashes it into the trailing stop, on camera, in ninety
seconds.

**HANDS does not swap.** It simulates a fill with configurable slippage and posts
the result. The DEX integration is the commodity layer — the interface between
BRAIN and BOOKS is stable regardless of what sits between them.

**Basis method is average-cost, not FIFO.** One basis per token. For multi-lot
tax reporting, FIFO lot queues would be required. Declared, not hidden.

---

## Run it

```bash
forge build
forge script script/Deploy.s.sol --rpc-url $XLAYER_RPC --broadcast
node keeper.js
```

Then in a second terminal, drive the price:

```bash
# rung 0 — +25%
cast send $BTC_FEED "setPrice(int256)" 12500000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# chop — falls, then back above +20%. Nothing fires. Rung 0 is spent.
cast send $BTC_FEED "setPrice(int256)" 11000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC
cast send $BTC_FEED "setPrice(int256)" 12600000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# rung 1 — +50%, peak ratchets to $160k
cast send $BTC_FEED "setPrice(int256)" 16000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# crash — 31% off peak, still above basis. TRAIL fires. Full exit, in profit.
cast send $BTC_FEED "setPrice(int256)" 11000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC
```

---

## Built for

xLayer hackathon

