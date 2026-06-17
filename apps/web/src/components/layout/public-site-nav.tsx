"use client";

import Link from "next/link";

import { PipelineLogo } from "@/components/layout/pipeline-logo";

interface PublicSiteNavProps {
  active?: "features" | "guide" | "pricing";
  fixed?: boolean;
}

export function PublicSiteNav({ active, fixed = false }: Readonly<PublicSiteNavProps>) {
  return (
    <header className={`public-site-nav${fixed ? " public-site-nav--fixed" : ""}`} data-active-section={active ?? undefined}>
      <Link className="public-site-brand" href="/" aria-label="AlphaCI home">
        <span className="public-site-brand-mark">
          <PipelineLogo size={44} />
        </span>
        <span>AlphaCI</span>
      </Link>

      <div className="public-site-actions">
        <Link className="public-site-login" href="/login">Login</Link>
        <Link className="public-site-cta" href="/subscribe"><span aria-hidden="true" />Pricing</Link>
      </div>
    </header>
  );
}
