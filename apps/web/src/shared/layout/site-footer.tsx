import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#09090b] px-[clamp(2rem,7vw,8rem)] pb-8 pt-16 text-[var(--text-secondary)] max-[640px]:px-6">
      <div className="mb-16 grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-[var(--text-primary)] transition-colors hover:text-[var(--brand)]"
          >
            <Image
              src="/alphaci-logo.png"
              alt="AlphaCI"
              width={48}
              height={48}
              unoptimized
              className="size-11 object-contain"
            />
            <span className="font-mono text-xl font-bold">AlphaCI</span>
          </Link>
          <p className="max-w-[28ch] text-[0.9rem] leading-[1.6]">
            Governed pipelines for teams that ship with confidence.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="mb-2 text-[var(--text-primary)] font-semibold">Explore</h2>
          <Link className="text-[0.9rem] transition-colors hover:text-[var(--brand)]" href="/signup">
            Start free
          </Link>
          <Link className="text-[0.9rem] transition-colors hover:text-[var(--brand)]" href="/guide">
            Guide
          </Link>
          <Link className="text-[0.9rem] transition-colors hover:text-[var(--brand)]" href="/login">
            Log in
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="mb-2 text-[var(--text-primary)] font-semibold">Contact</h2>
          <a
            className="text-[0.9rem] transition-colors hover:text-[var(--brand)]"
            href="mailto:inquire.alphaci@alphaexplora.com"
          >
            inquire.alphaci@alphaexplora.com
          </a>
          <a
            className="text-[0.9rem] transition-colors hover:text-[var(--brand)]"
            href="https://alphaexplora.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Alphaexplora Information Technology Services
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center text-[0.85rem] text-[var(--text-muted)] md:flex-row md:text-left">
        <span>Powered by Alphaexplora Information Technology Services</span>
        <span>&copy; {new Date().getFullYear()} AlphaCI.</span>
      </div>
    </footer>
  );
}

