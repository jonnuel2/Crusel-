# Profit Taker

A callable profit-taking agent on X Layer. You give it a position and an exit
ladder. It watches price, and when a rung or a trailing stop triggers, it emits
a signed call — what to sell, how much, and why.

**It does not hold your funds. It does not execute trades.** It makes calls, and
it keeps a public record of every one — including the calls nobody took.

Deployed on X Layer testnet (chain 1952).

---

## What it is

Three contracts.

**BRAIN** — the policy engine. Reads an oracle, compares price to cost basis,
decides whether an exit condition is met. Emits an intent. Never touches funds.

**RECORD** — the public log. Every call BRAIN makes is written here, whether or
not anyone acts on it. Callers who execute can acknowledge, which is how the
agent builds a track record.

**HANDS** — a *reference caller*. It shows an integrator how to acknowledge a
call they acted on. It is not privileged. Anyone can do what it does.

---

## The two problems this solves

### 1. Chop re-fires the same exit

Naive design: *sell 25% whenever gain > 20%.* Price hits +25%, sells. Falls to
+5%. Climbs to +26%. **Sells again** — gain is still measured against the
original entry. On a choppy market it bleeds the position out on the same signal,
over and over. A cooldown only hides this.

**Fix: a ratcheting ladder.** Exits are rungs, not a repeating threshold.

| Rung | Trigger | Sells |
|------|---------|-------|
| 0    | +20%    | 25%   |
| 1    | +50%    | 25%   |
| 2    | +100%   | 50%   |

`rungsFired` only increments. Once rung 0 fires, it is spent permanently. Price
can swing back through +20% a hundred times — the next unfired rung sits at +50%,
and nothing else can trigger. **The ladder ratchets one direction.**

One subtlety: `sellBps` is a percentage of *original* units, not remaining. If it
were remaining, four 25% rungs would sell 25%, then 25% of the leftover 75%, then
25% of that — asymptotically approaching zero, never exiting. As written,
25+25+50 = 100% of the original, and `setPosition` rejects any ladder summing
over 100%.

### 2. It rides a winner all the way back down

The ladder handles the climb. It does nothing when price peaks between rungs and
collapses.

**Fix: a trailing stop — that arms on your terms.**

A trail that is live from the moment you enter will fire on noise. So the trail
has two parameters:

```solidity
uint256 trailArmBps;   // 10000 → stays dormant until +100%
uint256 trailBps;      // 3000  → then exits on a 30% giveback from peak
```

Concretely: you buy BTC at $50,000 and you do not want a trailing stop thinking
about anything until BTC clears $100,000. Set `trailArmBps = 10000`.

- $50k → $95k: **trail dormant.** Rungs may fire. No trailing exit, no matter the
  swings.
- BTC touches $100k: **trail arms.** Peak tracking begins.
- BTC runs to $130k: peak = $130k.
- BTC falls to $91k: 30% off peak → **full exit, still +82% up.**

This is not a stop-loss. It fires *in profit*. It protects a gain rather than
capping a loss.

Trail is checked before rungs. If price spikes past three rungs and then crashes
in a single block, you get one clean trailing exit — not three sequential rung
fires into a falling market.

---

## The record — and why there is no ledger

The agent does not custody funds. So it cannot verify what you filled at, and it
will not pretend to.

An earlier version of this project kept a double-entry ledger — `Dr USDC`,
`Cr basis`, `Cr realized gain`. **It was removed.** Those numbers were computed
from a price the caller supplied, about a swap the contract never saw, involving
tokens it never held. It balanced perfectly and meant nothing.

What replaced it is narrower and true:

Intent      Trigger      Called at   Status      Executed by
1  RUNG +20%   $125,000.00  13:35:28    EXECUTED    0x4FAb…
2  RUNG +50%   $160,000.00  13:41:02    EXECUTED    0x4FAb…
3  TRAIL       $145,000.00  13:52:17    OPEN        —
3 calls · 2 executed · execution rate 67%

Every row is verifiable. The call is authoritative — BRAIN wrote it. The
acknowledgment names the address that claims to have acted.

**Row 3 is the important one.** The agent called the exit. Nobody took it. That is
in the permanent record, and it is not the agent's failure.

### Execution rate is the reputation metric

A log of your own predictions, scored by yourself, proves nothing. Anyone can
emit signals.

`executionRateBps()` is different — it counts how many of the agent's calls a
caller actually acted on. That is external validation, computed onchain, from a
record the agent cannot retroactively edit.

---

## Deployed — X Layer testnet (1952)

| Contract | Address |
|----------|---------|
| BRAIN    | `0x66225aDfbA5B9Ad7e1Ce1e581c5198FA2130De82` |
| RECORD   | `0x53459D8452ECf17956C3Cd4549B6d7cAc297f291` |
| HANDS    | `0xa39dfD7fE237F18e44303304F4123d91669732Ef` |
| BTC feed | `0x3b4c12CB7ec57685a0cadC7AB327512C4a5206FE` |
| ETH feed | `0x2241f2c452FE6004330CFd4ffB0e9B11c6e75C38` |

---

## Integrating

Two calls. That is the whole API.

**Poll for a signal** — free, no gas:
```solidity
(uint8 reason, uint256 units, uint256 gainBps, uint256 price)
    = brain.check(token);
// reason: 0 = none, 1 = RUNG, 2 = TRAIL
```

**Acknowledge, if you acted:**
```solidity
record.acknowledge(intentNonce, yourSwapTxHash);
```

You execute however you like — your DEX, your router, your slippage bounds, your
custody. The agent has no opinion and no access.

---

## Honest scope

**The oracle is mocked.** X Layer's documented Chainlink-compatible feed addresses
did not resolve to deployed contracts on either testnet or mainnet at build time.
`MockAggregator` implements the exact `AggregatorV3Interface` that BRAIN consumes
— a real feed is a one-line config change and zero code change.

This is also the better demo. A live BTC feed cannot show you a ladder, because
BTC will not move 20% during a two-minute video.

**Acknowledgments are unverified.** A caller reports a tx hash; the contract does
not confirm the swap occurred. Proving an external transaction onchain is
genuinely hard. What the record gives you is *attribution* — every acknowledgment
carries the address that made it. Lying is possible and permanently attributable.

**Single-tenant.** One position per token, set by the owner. Multi-tenant would
require `mapping(address => mapping(address => Position))` and a custody model for
the funds. Both are out of scope here and both are the obvious next step.

**Basis is average-cost, not FIFO.** One basis per token. Multi-lot tax reporting
would need lot queues. Declared, not hidden.

---

## Run it

```bash
forge build
forge script script/Deploy.s.sol --rpc-url $XLAYER_RPC --broadcast
node keeper.js
```

Then drive the price in a second terminal:

```bash
# +25% — rung 0 fires
cast send $BTC_FEED "setPrice(int256)" 12500000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# chop: falls, then back above +20%. Nothing fires. Rung 0 is spent.
cast send $BTC_FEED "setPrice(int256)" 11000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC
cast send $BTC_FEED "setPrice(int256)" 12600000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# +60% — rung 1 fires. Trail still DORMANT: arms at +100%.
cast send $BTC_FEED "setPrice(int256)" 16000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# crash to +20% — a 25% giveback. Trail never armed, so nothing fires.
cast send $BTC_FEED "setPrice(int256)" 12000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# clear +100%. Trail arms. Peak $210k.
cast send $BTC_FEED "setPrice(int256)" 21000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC

# crash to $140k — 33% off peak. TRAIL fires. Full exit, still +40% up.
cast send $BTC_FEED "setPrice(int256)" 14000000000000 --private-key $PRIVATE_KEY --rpc-url $XLAYER_RPC
```

Set `AUTO_EXECUTE = false` in `keeper.js` to watch the agent make calls that
nobody takes — and see the execution rate fall.

---

## Built for

xLayer Hackathon

