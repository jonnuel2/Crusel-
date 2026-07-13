"use client";

import { type Rung } from "@/lib/chain";

type Props = {
  ladder: Rung[];
  gainBps: bigint;
  rungsFired: bigint;
  trailArmBps: bigint;
  trailArmed: boolean;
};

/**
 * The ladder is the one spatial idea in the product: rungs are climbed once,
 * and a climbed rung goes dead permanently. Price can fall back through it
 * and nothing happens. This draws that.
 */
export default function Ladder({
  ladder,
  gainBps,
  rungsFired,
  trailArmBps,
  trailArmed,
}: Props) {
  const gain = Number(gainBps);
  const fired = Number(rungsFired);
  const armAt = Number(trailArmBps);

  const top = Math.max(
    armAt,
    ...ladder.map((r) => Number(r.gainBps)),
    gain,
  );
  const ceiling = top * 1.15 || 10000;

  const y = (bps: number) => 100 - (bps / ceiling) * 100;

  return (
    <div className="relative h-[380px] w-full">
      {/* spine */}
      <div className="absolute left-[86px] top-0 h-full w-px bg-rule" />

      {/* basis line */}
      <div
        className="absolute left-0 right-0 flex items-center"
        style={{ top: "100%" }}
      >
        <div className="w-[86px] pr-3 text-right">
          <span className="mono text-[10px] text-graphite">ENTRY</span>
        </div>
        <div className="h-px flex-1 bg-ink" />
      </div>

      {/* trail arm threshold */}
      <div
        className="absolute left-0 right-0 flex items-center transition-all duration-700"
        style={{ top: `${y(armAt)}%` }}
      >
        <div className="w-[86px] pr-3 text-right">
          <span
            className={`mono text-[10px] ${
              trailArmed ? "text-plum" : "text-graphite"
            }`}
          >
            TRAIL {trailArmed ? "ARMED" : "ARMS"}
          </span>
        </div>
        <div
          className={`h-px flex-1 transition-colors duration-700 ${
            trailArmed ? "bg-plum" : ""
          }`}
          style={
            trailArmed
              ? undefined
              : {
                  backgroundImage:
                    "repeating-linear-gradient(to right, #8a8580 0 4px, transparent 4px 9px)",
                  height: "1px",
                }
          }
        />
        <div className="w-16 pl-3">
          <span className="mono text-[10px] text-graphite">
            +{armAt / 100}%
          </span>
        </div>
      </div>

      {/* rungs */}
      {ladder.map((r, i) => {
        const bps = Number(r.gainBps);
        const spent = i < fired;
        const next = i === fired;

        return (
          <div
            key={i}
            className="absolute left-0 right-0 flex items-center transition-all duration-700"
            style={{ top: `${y(bps)}%` }}
          >
            <div className="w-[86px] pr-3 text-right">
              <span
                className={`mono text-[11px] tabular-nums ${
                  spent ? "text-graphite line-through" : "text-ink"
                }`}
              >
                +{bps / 100}%
              </span>
            </div>

            {/* node */}
            <div className="relative -ml-[5px] flex items-center">
              <div
                className={`h-[9px] w-[9px] rounded-full border transition-all duration-500 ${
                  spent
                    ? "border-rule bg-paper"
                    : next
                      ? "border-plum bg-plum"
                      : "border-graphite bg-paper"
                }`}
              />
              {next && (
                <div className="absolute inset-0 h-[9px] w-[9px] rounded-full bg-plum opacity-30 live-dot" />
              )}
            </div>

            <div
              className={`ml-2 h-px flex-1 transition-colors duration-500 ${
                spent ? "bg-rule" : next ? "bg-plum" : "bg-rule"
              }`}
            />

            <div className="w-24 pl-3">
              <span
                className={`mono text-[10px] ${
                  spent ? "text-graphite" : "text-ink"
                }`}
              >
                {spent ? "SPENT" : `sell ${Number(r.sellBps) / 100}%`}
              </span>
            </div>
          </div>
        );
      })}

      {/* live price marker */}
      <div
        className="absolute left-[86px] right-0 z-10 flex items-center transition-all duration-1000 ease-out"
        style={{ top: `${y(gain)}%` }}
      >
        <div className="h-px flex-1 bg-ink" />
        <div className="ml-2 flex items-center gap-1.5 border border-ink bg-ink px-2 py-0.5">
          <span className="h-1 w-1 rounded-full bg-paper live-dot" />
          <span className="mono text-[10px] font-medium text-paper">
            NOW +{(gain / 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
