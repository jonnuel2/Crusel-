"use client";

import Nav from "../components/Nav";
import Ladder from "../components/Ladder";
import { useAgent } from "@/lib/useAgent";
import { usd, units, short, clock, day, RECORD } from "@/lib/chain";

const SYMBOL: Record<string, string> = {
  "0x0000000000000000000000000000000000000b7c": "BTC",
  "0x0000000000000000000000000000000000000e74": "ETH",
};

export default function RecordPage() {
  const { calls, callCount, executedCount, rateBps, tokens, loading, error } =
    useAgent(8000);

  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[1180px] px-6 py-16">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-8 border-b border-ink pb-8">
          <div>
            <p className="eyebrow mb-3">Public record</p>
            <h1 className="display text-[36px] sm:text-[44px]">
              Every call, and who took it
            </h1>
          </div>

          <div className="flex gap-9">
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                Calls
              </p>
              <p className="display mt-1 text-[28px]">{callCount}</p>
            </div>
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                Taken
              </p>
              <p className="display mt-1 text-[28px]">{executedCount}</p>
            </div>
            <div>
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                Rate
              </p>
              <p className="display mt-1 text-[28px] text-plum">
                {(rateBps / 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 border border-plum bg-wash px-5 py-4">
            <p className="mono text-[12px] text-plum">
              Couldn&apos;t reach X Layer. Retrying every 8 seconds.
            </p>
          </div>
        )}

        {/* positions */}
        <section className="mt-16">
          <p className="eyebrow mb-6">Positions</p>

          <div className="grid gap-6 lg:grid-cols-2">
            {tokens.map((t) => {
              const p = t.position;
              if (!p) return null;

              const sold = p.originalUnits - p.remainingUnits;
              const soldPct =
                p.originalUnits > 0n
                  ? Number((sold * 10000n) / p.originalUnits) / 100
                  : 0;

              return (
                <div key={t.symbol} className="border border-rule bg-paper">
                  {/* head */}
                  <div className="flex items-start justify-between border-b border-rule px-6 py-5">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="display text-[22px]">{t.symbol}</span>
                        <span
                          className={`mono border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                            p.active
                              ? "border-rule text-graphite"
                              : "border-ink bg-ink text-paper"
                          }`}
                        >
                          {p.active ? "open" : "closed"}
                        </span>
                      </div>
                      <p className="mono mt-2 text-[11px] text-graphite">
                        entry {usd(p.basisPerUnit)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="display text-[22px] tabular-nums">
                        {usd(t.price)}
                      </p>
                      <p
                        className={`mono mt-1 text-[12px] ${
                          Number(t.gainBps) > 0 ? "text-plum" : "text-graphite"
                        }`}
                      >
                        {Number(t.gainBps) > 0 ? "+" : ""}
                        {(Number(t.gainBps) / 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* ladder */}
                  <div className="px-6 py-8">
                    {t.ladder.length > 0 ? (
                      <Ladder
                        ladder={t.ladder}
                        gainBps={t.gainBps}
                        rungsFired={p.rungsFired}
                        trailArmBps={p.trailArmBps}
                        trailArmed={p.trailArmed}
                      />
                    ) : (
                      <div className="flex h-[380px] items-center justify-center">
                        <p className="mono text-[11px] text-graphite">
                          {loading ? "reading chain…" : "no ladder"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* stats */}
                  <div className="grid grid-cols-2 gap-px border-t border-rule bg-rule sm:grid-cols-4">
                    {[
                      ["held", units(p.remainingUnits)],
                      ["sold", `${soldPct.toFixed(0)}%`],
                      ["peak", usd(p.peakPrice)],
                      [
                        "trail",
                        p.trailArmed
                          ? `${Number(p.trailBps) / 100}% live`
                          : "asleep",
                      ],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-paper px-6 py-4">
                        <p className="mono text-[9px] uppercase tracking-[0.12em] text-graphite">
                          {k}
                        </p>
                        <p
                          className={`mono mt-1.5 text-[13px] ${
                            k === "trail" && p.trailArmed
                              ? "text-plum"
                              : "text-ink"
                          }`}
                        >
                          {v}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* the log */}
        <section className="mt-20">
          <div className="mb-6 flex items-baseline justify-between">
            <p className="eyebrow">The log</p>
            <a
              href={`https://web3.okx.com/explorer/x-layer-testnet/address/${RECORD}`}
              target="_blank"
              rel="noreferrer"
              className="mono text-[11px] text-graphite transition-colors hover:text-ink"
            >
              verify onchain ↗
            </a>
          </div>

          {calls.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center border border-rule">
              <p className="mono text-[12px] text-graphite">
                {loading
                  ? "reading chain…"
                  : "No calls yet. The agent is watching."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-rule">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-ink">
                    {[
                      "CALL",
                      "MKT",
                      "REASON",
                      "GAIN",
                      "UNITS",
                      "CALLED AT",
                      "WHEN",
                      "STATUS",
                      "TAKEN BY",
                    ].map((h) => (
                      <th
                        key={h}
                        className="eyebrow px-4 py-3 text-left text-[9px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {calls.map((c) => {
                    const open = c.status === 0;
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-rule transition-colors last:border-b-0 hover:bg-wash ${
                          open ? "bg-wash/70" : ""
                        }`}
                      >
                        <td className="mono px-4 py-3.5 text-[12px] text-graphite">
                          #{String(c.nonce).padStart(3, "0")}
                        </td>
                        <td className="mono px-4 py-3.5 text-[12px] font-medium">
                          {SYMBOL[c.token.toLowerCase()] ?? "—"}
                        </td>
                        <td className="mono px-4 py-3.5 text-[12px]">
                          {c.reason}
                        </td>
                        <td className="mono px-4 py-3.5 text-[12px] tabular-nums text-plum">
                          +{(Number(c.gainBps) / 100).toFixed(0)}%
                        </td>
                        <td className="mono px-4 py-3.5 text-[12px] tabular-nums">
                          {units(c.units)}
                        </td>
                        <td className="mono px-4 py-3.5 text-[12px] tabular-nums">
                          {usd(c.triggerPrice)}
                        </td>
                        <td className="mono px-4 py-3.5 text-[11px] text-graphite">
                          {clock(c.calledAt)}
                          <span className="ml-1.5 opacity-60">
                            {day(c.calledAt).slice(5)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`mono text-[10px] uppercase tracking-[0.1em] ${
                              open ? "text-plum" : "text-graphite"
                            }`}
                          >
                            {open ? "○ open" : "● taken"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {open ? (
                            <span className="mono text-[11px] text-graphite">
                              —
                            </span>
                          ) : (
                            <a
                              href={`https://web3.okx.com/explorer/x-layer-testnet/address/${c.executedBy}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mono text-[11px] text-ink underline decoration-rule underline-offset-2 transition-colors hover:decoration-ink"
                            >
                              {short(c.executedBy)}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 max-w-[620px] text-[12.5px] leading-relaxed text-graphite">
            Calls are written by the agent and are authoritative.
            Acknowledgements are made by the executing caller and are{" "}
            <span className="text-ink">attributed, not verified</span> — the
            contract records who claimed to act, not proof that they did. Crusel
            holds no funds and cannot confirm a fill.
          </p>
        </section>
      </main>

      <footer className="mt-8 border-t border-rule bg-wash/60">
        <div className="mx-auto max-w-[1180px] px-6 py-10">
          <p className="mono text-[11px] text-graphite">
            Reading X Layer testnet · chain 1952 · refreshing every 8s
          </p>
        </div>
      </footer>
    </>
  );
}
