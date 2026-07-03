"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PipelineLogo } from "@/components/layout/pipeline-logo";

interface PublicSiteNavProps {
  active?: "features" | "guide" | "pricing";
  fixed?: boolean;
  showActions?: boolean;
}

export function PublicSiteNav({
  active,
  fixed = false,
  showActions = true,
}: Readonly<PublicSiteNavProps>) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!fixed) return;

    function updateScrolled() {
      setScrolled(window.scrollY > 12);
    }

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, [fixed]);

  const className = [
    "public-site-nav",
    fixed ? "public-site-nav--fixed" : "",
    fixed && scrolled ? "public-site-nav--scrolled" : "",
    !showActions ? "public-site-nav--no-actions" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={className} data-active-section={active ?? undefined}>
      <Link className="public-site-brand" href="/" aria-label="Alphaexplora home">
        <span className="public-site-brand-mark">
          <PipelineLogo size={44} />
        </span>
        <span>Alphaexplora</span>
      </Link>

      {showActions && (
        <div className="public-site-actions">
          <Link className="public-site-login" href="/login">
            Login
          </Link>
          <Link className="public-site-cta" href="/subscribe">
            <span aria-hidden="true" />
            Pricing
          </Link>
        </div>
      )}
    </header>
  );
}
