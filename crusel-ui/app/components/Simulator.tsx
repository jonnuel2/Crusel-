"use client";

import { useState, useMemo } from "react";
import { useAgent } from "@/lib/useAgent";
import { usd } from "@/lib/chain";

type Rung = { at: number; sell: number };

const PRESETS: Record<string, { rungs: Rung[]; armAt: number; giveback: number }> = {
  Conservative: {
    rungs: [
      { at: 15, sell: 33 },
      { at: 30, sell: 33 },
      { at: 60, sell: 34 },
    ],
    armAt: 30,
    giveback: 20,
  },
  Balanced: {
    rungs: [
      { at: 20, sell: 25 },
      { at: 50, sell: 25 },
      { at: 100, sell: 50 },
    ],
    armAt: 100,
    giveback: 30,
  },
  "Let it run": {
    rungs: [
      { at: 50, sell: 20 },
      { at: 150, sell: 20 },
      { at: 300, sell: 30 },
    ],
    armAt: 200,
    giveback: 40,
  },
};

export default function Simulator() {
  const { tokens } = useAgent(15000);

  const [symbol, setSymbol] = useState("BTC");
  const [entry, setEntry] = useState(50000);
  const [amount, setAmount] = useState(2);
  const [preset, setPreset] = useState("Balanced");

  const cfg = PRESETS[preset];
  const live = tokens.find((t) => t.symbol === symbol);
  const livePrice = live ? Number(live.price) / 1e8 : 0;

  // What Crusel would call, right now, at the live oracle price.
  const verdict = useMemo(() => {
    if (!livePrice || !entry) return null;

    const gainPct = ((livePrice - entry) / entry) * 100;

    // rungs fire in order; assume none have fired yet (fresh position)
    const nextRung = cfg.rungs.find((r) => gainPct >= r.at);
    const trailArmed = gainPct >= cfg.armAt;

    return {
      gainPct,
      nextRung,
      trailArmed,
      // trail can't fire on a fresh position — peak == now
      wouldSell: nextRung ? (amount * nextRung.sell) / 100 : 0,
    };
  }, [livePrice, entry, amount, cfg]);

  const armPrice = entry * (1 + cfg.armAt / 100);

  return (
    <div className="border border-rule bg-paper">
      {/* ── inputs ── */}
      <div className="border-b border-rule px-6 py-6 sm:px-8">
        <p className="eyebrow mb-5">Describe your position</p>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="mono mb-2 block text-[10px] uppercase tracking-[0.12em] text-graphite">
              Asset
            </label>
            <div className="flex gap-1.5">
              {tokens.map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => setSymbol(t.symbol)}
                  className={`mono flex-1 border px-3 py-2 text-[13px] transition-colors ${
                    symbol === t.symbol
                      ? "border-ink bg-ink text-paper"
                      : "border-rule text-ink hover:border-ink"
                  }`}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mono mb-2 block text-[10px] uppercase tracking-[0.12em] text-graphite">
              You bought at
            </label>
            <div className="flex items-center border border-rule focus-within:border-ink">
              <span className="mono pl-3 text-[13px] text-graphite">$</span>
              <input
                type="number"
                value={entry}
                onChange={(e) => setEntry(Number(e.target.value) || 0)}
                className="mono w-full bg-transparent px-2 py-2 text-[13px] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mono mb-2 block text-[10px] uppercase tracking-[0.12em] text-graphite">
              How much you hold
            </label>
            <div className="flex items-center border border-rule focus-within:border-ink">
              <input
                type="number"
                step="0.1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="mono w-full bg-transparent px-3 py-2 text-[13px] outline-none"
              />
              <span className="mono pr-3 text-[13px] text-graphite">
                {symbol}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="mono mb-2 block text-[10px] uppercase tracking-[0.12em] text-graphite">
            Exit plan
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PRESETS).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`border px-4 py-2 text-[13px] transition-colors ${
                  preset === p
                    ? "border-ink bg-ink text-paper"
                    : "border-rule text-ink hover:border-ink"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── the plan ── */}
      <div className="grid lg:grid-cols-2">
        <div className="border-b border-rule px-6 py-6 sm:px-8 lg:border-b-0 lg:border-r">
          <p className="eyebrow mb-5">Your ladder</p>

          <div className="space-y-0">
            {cfg.rungs.map((r, i) => {
              const target = entry * (1 + r.at / 100);
              const reached = livePrice >= target;

              return (
                <div
                  key={i}
                  className={`flex items-center justify-between border-b border-rule py-3 last:border-b-0 ${
                    reached ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-[7px] w-[7px] rounded-full ${
                        reached ? "bg-plum" : "border border-graphite"
                      }`}
                    />
                    <span className="mono text-[13px]">+{r.at}%</span>
                    <span className="mono text-[11px] text-graphite">
                      ${target.toLocaleString()}
                    </span>
                  </div>
                  <span className="mono text-[12px]">
                    sell {r.sell}%
                    <span className="ml-2 text-graphite">
                      {((amount * r.sell) / 100).toFixed(3)} {symbol}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-ink pt-5">
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.12em] text-graphite">
              Trailing stop
            </p>
            <p className="text-[14px] leading-[1.6]">
              Asleep until{" "}
              <span className="mono">
                +{cfg.armAt}% (${armPrice.toLocaleString()})
              </span>
              . Then exits everything on a{" "}
              <span className="mono">{cfg.giveback}%</span> drop from peak.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-graphite">
              Below that price it does nothing — no giveback, however sharp,
              triggers an exit. That&apos;s the point.
            </p>
          </div>
        </div>

        {/* ── verdict ── */}
        <div className="bg-wash px-6 py-6 sm:px-8">
          <div className="mb-5 flex items-baseline justify-between">
            <p className="eyebrow">What Crusel says right now</p>
            <span className="mono flex items-center gap-1.5 text-[10px] text-graphite">
              <span className="h-1 w-1 rounded-full bg-plum live-dot" />
              live oracle
            </span>
          </div>

          {!verdict ? (
            <p className="mono text-[12px] text-graphite">reading chain…</p>
          ) : (
            <>
              <div className="mb-6">
                <p className="display text-[32px]">
                  {usd(BigInt(Math.round(livePrice * 1e8)))}
                </p>
                <p
                  className={`mono mt-1 text-[13px] ${
                    verdict.gainPct >= 0 ? "text-plum" : "text-graphite"
                  }`}
                >
                  {verdict.gainPct >= 0 ? "+" : ""}
                  {verdict.gainPct.toFixed(2)}% from your entry
                </p>
              </div>

              {verdict.nextRung ? (
                <div className="border border-ink bg-paper px-5 py-5">
                  <p className="mono mb-3 text-[11px] uppercase tracking-[0.14em] text-plum">
                    → RUNG
                  </p>
                  <p className="text-[18px] leading-snug">
                    Sell{" "}
                    <span className="mono">
                      {verdict.wouldSell.toFixed(3)} {symbol}
                    </span>
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-graphite">
                    You&apos;re past the +{verdict.nextRung.at}% rung. Crusel
                    would call this exit and log it — whether or not you take it.
                  </p>
                </div>
              ) : (
                <div className="border border-rule bg-paper px-5 py-5">
                  <p className="mono mb-3 text-[11px] uppercase tracking-[0.14em] text-graphite">
                    → NONE
                  </p>
                  <p className="text-[18px] leading-snug">Hold.</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-graphite">
                    Nothing triggered. The first rung sits at{" "}
                    <span className="mono text-ink">
                      ${(entry * (1 + cfg.rungs[0].at / 100)).toLocaleString()}
                    </span>
                    .
                  </p>
                </div>
              )}

              <div className="mt-5 flex items-center gap-2">
                <span
                  className={`h-[7px] w-[7px] rounded-full ${
                    verdict.trailArmed ? "bg-plum" : "border border-graphite"
                  }`}
                />
                <span className="mono text-[11.5px] text-graphite">
                  trail {verdict.trailArmed ? "ARMED" : "asleep"}
                  {!verdict.trailArmed &&
                    ` — wakes at $${armPrice.toLocaleString()}`}
                </span>
              </div>

              <p className="mt-7 border-t border-rule pt-5 text-[12.5px] leading-relaxed text-graphite">
                This is a preview against the live oracle — nothing is
                registered and no wallet is connected.{" "}
                <span className="text-ink">
                  Connect Crusel to your agent
                </span>{" "}
                to make it real: your agent signs the position, so it belongs to
                you, and Crusel starts watching it.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
