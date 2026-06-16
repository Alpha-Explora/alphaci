"use client";

import Link from "next/link";

import { PipelineLogo } from "@/components/layout/pipeline-logo";

interface PublicSiteNavProps {
  active?: "features" | "guide" | "pricing";
  fixed?: boolean;
}

export function PublicSiteNav({ active, fixed = false }: Readonly<PublicSiteNavProps>) {
  return (
    <header className={`public-site-nav${fixed ? " public-site-nav--fixed" : ""}`}>
      <Link className="public-site-brand" href="/" aria-label="FlowCI Studio home">
        <span className="public-site-brand-mark">
          <PipelineLogo size={18} />
        </span>
        <span>FlowCI Studio</span>
      </Link>

      <nav className="public-site-links" aria-label="Public navigation">
        <Link href="/#features" aria-current={active === "features" ? "page" : undefined}>
          Features
        </Link>
        <Link href="/guide" aria-current={active === "guide" ? "page" : undefined}>
          Guide
        </Link>
        <Link href="/subscribe" aria-current={active === "pricing" ? "page" : undefined}>
          Pricing
        </Link>
      </nav>

      <div className="public-site-actions">
        <Link className="public-site-login" href="/login">Log in</Link>
        <Link className="public-site-cta" href="/signup">Start free</Link>
      </div>
    </header>
  );
}
