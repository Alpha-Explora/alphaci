import type { ReactNode } from "react";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PublicSiteNav } from "@/shared/layout/public-site-nav";
import { SkipLink } from "@/shared/layout/public-shell";
import { SiteFooter } from "@/shared/layout/site-footer";

type LandingShellActive = "features" | "guide" | "pricing";

interface LandingShellProps {
  active?: LandingShellActive;
  children: ReactNode;
}

export function LandingShell({ active = "features", children }: Readonly<LandingShellProps>) {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-soft text-foreground" data-landing-shell="true">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <FlowBackground />
      <PublicSiteNav active={active} fixed />
      <div id="main-content">
        {children}
      </div>
      <SiteFooter />
    </main>
  );
}


