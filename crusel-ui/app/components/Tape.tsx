"use client";

import { usdShort, short, type Call } from "@/lib/chain";

const SYMBOL: Record<string, string> = {
  "0x0000000000000000000000000000000000000b7c": "BTC",
  "0x0000000000000000000000000000000000000e74": "ETH",
};

function Row({ c }: { c: Call }) {
  const open = c.status === 0;
  return (
    <div
      className={`grid grid-cols-[52px_46px_1fr_86px_92px] items-center gap-3 border-b border-rule px-4 py-2.5 sm:grid-cols-[52px_46px_1fr_86px_92px_110px] ${
        open ? "bg-wash" : ""
      }`}
    >
      <span className="mono text-[11px] text-graphite">
        #{String(c.nonce).padStart(3, "0")}
      </span>
      <span className="mono text-[11px] font-medium">
        {SYMBOL[c.token.toLowerCase()] ?? "—"}
      </span>
      <span className="mono text-[11px]">
        {c.reason}
        <span className="ml-1.5 text-graphite">
          +{(Number(c.gainBps) / 100).toFixed(0)}%
        </span>
      </span>
      <span className="mono text-[11px] tabular-nums">
        {usdShort(c.triggerPrice)}
      </span>
      <span
        className={`mono text-[10px] uppercase tracking-[0.1em] ${
          open ? "text-plum" : "text-graphite"
        }`}
      >
        {open ? "○ open" : "● taken"}
      </span>
      <span className="mono hidden text-[10px] text-graphite sm:block">
        {open ? "—" : short(c.executedBy)}
      </span>
    </div>
  );
}

export default function Tape({ calls }: { calls: Call[] }) {
  if (calls.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center border border-rule bg-paper">
        <p className="mono text-[11px] text-graphite">
          No calls yet. The agent is watching.
        </p>
      </div>
    );
  }

  // duplicate for seamless loop when there's enough to scroll
  const scroll = calls.length >= 5;
  const feed = scroll ? [...calls, ...calls] : calls;

  return (
    <div className="tape overflow-hidden border border-rule bg-paper">
      <div className="grid grid-cols-[52px_46px_1fr_86px_92px] gap-3 border-b border-ink bg-paper px-4 py-2 sm:grid-cols-[52px_46px_1fr_86px_92px_110px]">
        {["CALL", "MKT", "REASON", "AT", "STATUS", "TAKEN BY"].map((h, i) => (
          <span
            key={h}
            className={`eyebrow text-[9px] ${i === 5 ? "hidden sm:block" : ""}`}
          >
            {h}
          </span>
        ))}
      </div>

      <div className="relative h-[220px] overflow-hidden">
        <div className={scroll ? "tape-track" : ""}>
          {feed.map((c, i) => (
            <Row key={`${c.id}-${i}`} c={c} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-paper to-transparent" />
      </div>
    </div>
  );
}
