"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

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
      <Link className="public-site-brand" href="/" aria-label="ALPHACI home">
        <Image
          src="/brand-logo.png"
          alt="ALPHACI"
          width={132}
          height={44}
          priority
          unoptimized
          className="public-site-brand-image"
          style={{
            display: "block",
            height: 44,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
          }}
        />
      </Link>

      {showActions && (
        <div className="public-site-actions">
          <Link className="public-site-login" href="/login">
            Login
          </Link>
          <Link className="public-site-cta" href="/signup">
            <span aria-hidden="true" />
            Get started
          </Link>
        </div>
      )}
    </header>
  );
}
