import Link from "next/link";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-rule bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <circle cx="10" cy="10" r="8.5" stroke="#2e1428" strokeWidth="1.6" />
            <path
              d="M13.5 6.5a5 5 0 100 7"
              stroke="#2e1428"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className="display text-[17px] tracking-[0.14em] text-plum">
            CRUSEL
          </span>
        </Link>

        <div className="flex items-center gap-7">
          <Link
            href="/record"
            className="mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:text-ink"
          >
            Record
          </Link>
          <a
            href="https://github.com/jonnuel2/Crusel-"
            target="_blank"
            rel="noreferrer"
            className="mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:text-ink"
          >
            Source
          </a>
          <span className="hidden items-center gap-1.5 border border-rule px-2.5 py-1 sm:flex">
            <span className="h-1 w-1 rounded-full bg-plum live-dot" />
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-graphite">
              X Layer 1952
            </span>
          </span>
        </div>
      </div>
    </nav>
  );
}
