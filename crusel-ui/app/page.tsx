"use client";

import Link from "next/link";
import Nav from "./components/Nav";
import Tape from "./components/Tape";
import Ladder from "./components/Ladder";
import Reveal from "./components/Reveal";
import { useAgent } from "@/lib/useAgent";
import { BRAIN, RECORD, short } from "@/lib/chain";

export default function Home() {
  const { calls, callCount, executedCount, rateBps, tokens, loading } = useAgent();
  const btc = tokens.find((t) => t.symbol === "BTC");

  return (
    <>
      <Nav />

      {/* hero */}
      <section className="mx-auto max-w-[1180px] px-6 pb-24 pt-20 sm:pt-28">
        <div className="grid gap-14 lg:grid-cols-[1fr_460px] lg:gap-16">
          <div>
            <p className="eyebrow rise mb-6">Profit-taking agent · X Layer</p>

            <h1
              className="display rise text-[42px] sm:text-[58px] lg:text-[64px]"
              style={{ animationDelay: "60ms" }}
            >
              It calls the exit.
              <br />
              <span className="text-plum">You keep the keys.</span>
            </h1>

            <p
              className="rise mt-7 max-w-[440px] text-[15px] leading-[1.65] text-graphite"
              style={{ animationDelay: "140ms" }}
            >
              Give Crusel a position and an exit ladder. It watches price and
              signs a call when a rung or a trailing stop triggers — what to
              sell, how much, and why.
            </p>

            <p
              className="rise mt-4 max-w-[440px] text-[15px] leading-[1.65]"
              style={{ animationDelay: "180ms" }}
            >
              It never holds your funds and never touches a router. It makes
              calls, and it keeps a public record of every one — including the
              calls nobody took.
            </p>

            <div
              className="rise mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                href="/record"
                className="border border-ink bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-all hover:border-plum hover:bg-plum focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              >
                See every call it made
              </Link>
              <a
                href="#how"
                className="border border-rule px-5 py-2.5 text-[13px] text-ink transition-colors hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
              >
                How it decides
              </a>
            </div>
          </div>

          <div className="rise" style={{ animationDelay: "320ms" }}>
            <div className="mb-3 flex items-baseline justify-between">
              <span className="eyebrow">Live record</span>
              <span className="mono text-[11px] text-graphite">
                {loading ? "reading chain…" : `${executedCount}/${callCount} taken`}
              </span>
            </div>

            <Tape calls={calls} />

            <p className="mt-3 text-[12px] leading-relaxed text-graphite">
              Open rows are calls no one executed. They stay in the record.
              That&apos;s the point.
            </p>
          </div>
        </div>
      </section>

      {/* the two problems */}
      <section id="how" className="border-t border-rule bg-wash/60">
        <div className="mx-auto max-w-[1180px] px-6 py-24">
          <Reveal>
            <p className="eyebrow mb-4">What most exit bots get wrong</p>
            <h2 className="display max-w-[620px] text-[32px] sm:text-[40px]">
              Two bugs, and neither is about the code.
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div className="border-t border-ink pt-6">
                <p className="mono mb-4 text-[11px] uppercase tracking-[0.14em] text-plum">
                  Chop sells the same position twice
                </p>

                <p className="text-[15px] leading-[1.7] text-graphite">
                  The naive rule is{" "}
                  <span className="mono text-[13px] text-ink">
                    sell 25% when gain &gt; 20%
                  </span>
                  . Price hits +25%, it sells. Falls to +5%. Climbs to +26%.
                  <span className="text-ink"> It sells again</span> — gain is
                  still measured from the original entry. On a choppy market it
                  bleeds the position out on the same signal, over and over.
                </p>

                <p className="mt-4 text-[15px] leading-[1.7] text-graphite">
                  A cooldown timer only hides this.
                </p>

                <div className="mt-6 border-l-2 border-plum bg-paper py-4 pl-5">
                  <p className="text-[15px] leading-[1.7]">
                    Crusel&apos;s exits are{" "}
                    <span className="font-medium">rungs, not a threshold</span>.
                    Once a rung fires it is spent permanently. Price can swing
                    back through +20% a hundred times — the next unfired rung
                    sits at +50%, and nothing else can trigger.
                  </p>
                  <p className="mono mt-3 text-[12px] text-plum">
                    The ladder ratchets one direction.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="border-t border-ink pt-6">
                <p className="mono mb-4 text-[11px] uppercase tracking-[0.14em] text-plum">
                  It rides the winner back down
                </p>

                <p className="text-[15px] leading-[1.7] text-graphite">
                  The ladder handles the climb. It does nothing when price peaks
                  between two rungs and collapses. So you want a trailing stop —
                  except a trail that&apos;s live from the moment you enter will
                  fire on noise.
                </p>

                <p className="mt-4 text-[15px] leading-[1.7] text-graphite">
                  So you say when it wakes up.
                </p>

                <div className="mt-6 border-l-2 border-plum bg-paper py-4 pl-5">
                  <p className="text-[15px] leading-[1.7]">
                    You bought BTC at $50k and you don&apos;t want a trailing
                    stop thinking about anything until it clears $100k. Set the
                    arming threshold to +100%.
                  </p>
                  <p className="mono mt-3 text-[12px] leading-relaxed text-graphite">
                    $50k → $95k — dormant, no matter the swings
                    <br />
                    <span className="text-plum">$100k — trail arms</span>
                    <br />
                    $130k — peak
                    <br />
                    <span className="text-ink">
                      $91k — 30% off peak, full exit, still +82% up
                    </span>
                  </p>
                </div>

                <p className="mt-5 text-[15px] leading-[1.7]">
                  This isn&apos;t a stop-loss. It fires{" "}
                  <span className="font-medium">in profit</span>. It protects a
                  gain rather than capping a loss.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* the ladder, live */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[1180px] px-6 py-24">
          <div className="grid gap-14 lg:grid-cols-[380px_1fr] lg:gap-20">
            <Reveal>
              <p className="eyebrow mb-4">The ladder, right now</p>
              <h2 className="display text-[30px] sm:text-[36px]">
                Climbed rungs
                <br />
                go dead.
              </h2>
              <p className="mt-6 text-[15px] leading-[1.7] text-graphite">
                This is Crusel&apos;s live BTC position on X Layer testnet, read
                straight from the contract. Struck-through rungs have fired and
                cannot fire again.
              </p>
              <p className="mt-4 text-[15px] leading-[1.7] text-graphite">
                The dashed line is where the trailing stop wakes up. Below it,
                the trail is asleep — no giveback, however sharp, will trigger
                an exit.
              </p>

              <Link
                href="/record"
                className="mono mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink transition-colors hover:text-plum"
              >
                Full position
                <span aria-hidden>→</span>
              </Link>
            </Reveal>

            <Reveal delay={100}>
              <div className="border border-rule bg-paper px-6 py-10 sm:px-10">
                {btc?.position && btc.ladder.length > 0 ? (
                  <Ladder
                    ladder={btc.ladder}
                    gainBps={btc.gainBps}
                    rungsFired={btc.position.rungsFired}
                    trailArmBps={btc.position.trailArmBps}
                    trailArmed={btc.position.trailArmed}
                  />
                ) : (
                  <div className="flex h-[380px] items-center justify-center">
                    <p className="mono text-[11px] text-graphite">
                      {loading ? "reading chain…" : "no position"}
                    </p>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* no ledger */}
      <section className="border-t border-rule bg-ink text-paper">
        <div className="mx-auto max-w-[1180px] px-6 py-24">
          <Reveal>
            <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-graphite">
              What we deleted
            </p>
            <h2 className="display max-w-[720px] text-[32px] sm:text-[42px]">
              We built a double-entry ledger.
              <br />
              It balanced perfectly.
              <br />
              <span className="text-graphite">It meant nothing.</span>
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal delay={80}>
              <p className="text-[15px] leading-[1.75] text-graphite">
                An earlier version of Crusel kept proper books.{" "}
                <span className="mono text-[13px] text-paper">Dr USDC</span>,{" "}
                <span className="mono text-[13px] text-paper">Cr basis</span>,{" "}
                <span className="mono text-[13px] text-paper">
                  Cr realized gain
                </span>
                . Every entry balanced. There was a function that proved it
                onchain.
              </p>

              <p className="mt-5 text-[15px] leading-[1.75] text-graphite">
                Then we asked where the money was.
              </p>

              <p className="mt-5 text-[15px] leading-[1.75] text-paper">
                The proceeds were computed from a price the caller supplied,
                about a swap the contract never saw, involving tokens it never
                held. The agent doesn&apos;t custody funds — so it cannot verify
                a fill, and it has no business claiming one.
              </p>

              <p className="mt-5 text-[15px] leading-[1.75] text-graphite">
                So we deleted it. What replaced it is narrower, and true.
              </p>
            </Reveal>

            <Reveal delay={160}>
              <div className="border border-graphite/30">
                <div className="border-b border-graphite/30 px-5 py-3">
                  <span className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                    What the record can prove
                  </span>
                </div>

                <div className="divide-y divide-graphite/20">
                  {[
                    ["We made this call", "BRAIN wrote it. Authoritative."],
                    [
                      "At this price, at this time",
                      "Read from the oracle, onchain.",
                    ],
                    ["This address says it acted", "Attributed. Not verified."],
                    ["Nobody took this one", "Permanent. Not our failure."],
                  ].map(([claim, note]) => (
                    <div key={claim} className="flex gap-4 px-5 py-4">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-paper" />
                      <div>
                        <p className="text-[14px] leading-snug text-paper">
                          {claim}
                        </p>
                        <p className="mono mt-1 text-[11px] text-graphite">
                          {note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-6 text-[13px] leading-relaxed text-graphite">
                Every number Crusel shows you is one it can defend. There is no
                balance sheet here because there is no balance.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* execution rate */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[1180px] px-6 py-24">
          <div className="grid gap-14 lg:grid-cols-[1fr_400px] lg:gap-20">
            <Reveal>
              <p className="eyebrow mb-4">Why you should believe it</p>
              <h2 className="display max-w-[520px] text-[32px] sm:text-[40px]">
                Anyone can emit signals.
                <br />
                Not everyone gets followed.
              </h2>

              <p className="mt-7 max-w-[520px] text-[15px] leading-[1.7] text-graphite">
                A log of your own predictions, scored by yourself, proves
                nothing. Crusel doesn&apos;t ask you to trust its calls — it
                counts how many of them somebody{" "}
                <span className="text-ink">actually acted on</span>.
              </p>

              <p className="mt-5 max-w-[520px] text-[15px] leading-[1.7] text-graphite">
                That number is external validation, computed onchain, from a
                record the agent cannot go back and edit. Calls nobody took stay
                in it forever.
              </p>

              <div className="mt-9 flex flex-wrap gap-x-10 gap-y-6">
                <div>
                  <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                    Calls made
                  </p>
                  <p className="display mt-1.5 text-[34px]">{callCount}</p>
                </div>
                <div>
                  <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                    Taken
                  </p>
                  <p className="display mt-1.5 text-[34px]">{executedCount}</p>
                </div>
                <div>
                  <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                    Execution rate
                  </p>
                  <p className="display mt-1.5 text-[34px] text-plum">
                    {(rateBps / 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="border border-rule bg-paper">
                <div className="border-b border-rule px-5 py-3">
                  <span className="eyebrow">Two calls. That&apos;s the API.</span>
                </div>

                <div className="px-5 py-6">
                  <p className="mono mb-2 text-[10px] uppercase tracking-[0.12em] text-graphite">
                    Poll for a signal — free
                  </p>
                  <pre className="mono overflow-x-auto text-[11.5px] leading-relaxed text-ink">
{`(uint8 reason,
 uint256 units,
 uint256 gainBps,
 uint256 price) = brain.check(token);

// 0 = none
// 1 = RUNG
// 2 = TRAIL`}
                  </pre>

                  <div className="my-6 h-px bg-rule" />

                  <p className="mono mb-2 text-[10px] uppercase tracking-[0.12em] text-graphite">
                    Acknowledge, if you acted
                  </p>
                  <pre className="mono overflow-x-auto text-[11.5px] leading-relaxed text-ink">
{`record.acknowledge(
  intentNonce,
  yourSwapTxHash
);`}
                  </pre>
                </div>

                <div className="border-t border-rule bg-wash px-5 py-4">
                  <p className="text-[12.5px] leading-relaxed text-graphite">
                    You execute however you like — your DEX, your router, your
                    slippage bounds, your custody. Crusel has no opinion and no
                    access.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-rule bg-wash/60">
        <div className="mx-auto max-w-[1180px] px-6 py-14">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <span className="display text-[15px] tracking-[0.14em] text-plum">
                CRUSEL
              </span>
              <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-graphite">
                A callable profit-taking agent. Deployed on X Layer testnet,
                chain 1952.
              </p>
            </div>

            <div className="flex flex-wrap gap-14">
              <div>
                <p className="eyebrow mb-3">Contracts</p>
                <div className="space-y-1.5">
                  <a
                    href={`https://web3.okx.com/explorer/x-layer-testnet/address/${BRAIN}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono block text-[11px] text-graphite transition-colors hover:text-ink"
                  >
                    BRAIN {short(BRAIN)}
                  </a>
                  <a
                    href={`https://web3.okx.com/explorer/x-layer-testnet/address/${RECORD}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono block text-[11px] text-graphite transition-colors hover:text-ink"
                  >
                    RECORD {short(RECORD)}
                  </a>
                </div>
              </div>

              <div>
                <p className="eyebrow mb-3">Scope</p>
                <p className="max-w-[220px] text-[12px] leading-relaxed text-graphite">
                  Oracle is mocked — X Layer&apos;s documented feeds did not
                  resolve at build time. Same interface, one-line swap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
