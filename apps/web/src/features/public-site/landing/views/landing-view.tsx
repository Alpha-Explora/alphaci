"use client";

import { useReducedMotion, useScroll } from "framer-motion";

import { useAuthSession } from "@/features/auth/session";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { ActivityStrip } from "./activity-strip";
import { EducationSection } from "./education-section";
import { FeatureStripSection } from "./feature-strip-section";
import { HeroSection } from "./hero-section";
import { LandingPricingSection } from "./landing-pricing-section";
import { LandingSectionDivider } from "./landing-section-divider";
import { LandingShell } from "./landing-shell";
import { MorphReveal, ScrollProgressBar } from "./landing-motion";
import { PipelineShowcaseSection } from "./pipeline-showcase-section";
import { ReleaseLanesSection } from "./release-lanes-section";
import { SupportedStacksSection } from "./supported-stacks-section";
import { TestimonialsSection } from "./testimonials-section";
import { WhyAlphaCISection } from "./why-alphaci-section";

export function LandingView() {
  const prefersReducedMotion = useReducedMotion();
  const { status } = useAuthSession();
  const { scrollYProgress: pageScrollYProgress } = useScroll();

  if (status === "loading") {
    return <PipelineLoader label="Loading AlphaCI" />;
  }

  const primaryHref = status === "signed-in" ? "/home" : "/signup";

  return (
    <LandingShell active="features">
      <ScrollProgressBar reduced={prefersReducedMotion} />
      <HeroSection
        reduced={prefersReducedMotion}
        primaryHref={primaryHref}
        primaryLabel="Get Started"
        pageScrollYProgress={pageScrollYProgress}
      />
      <SupportedStacksSection />
      <MorphReveal reduced={prefersReducedMotion}>
        <WhyAlphaCISection reduced={prefersReducedMotion} />
      </MorphReveal>
      <MorphReveal reduced={prefersReducedMotion}>
        <PipelineShowcaseSection reduced={prefersReducedMotion} />
      </MorphReveal>
      <MorphReveal reduced={prefersReducedMotion}>
        <FeatureStripSection reduced={Boolean(prefersReducedMotion)} />
      </MorphReveal>
      <LandingSectionDivider reduced={Boolean(prefersReducedMotion)} />
      <MorphReveal reduced={prefersReducedMotion}>
        <ReleaseLanesSection reduced={prefersReducedMotion} />
      </MorphReveal>
      <LandingSectionDivider reduced={Boolean(prefersReducedMotion)} />
      <MorphReveal reduced={prefersReducedMotion}>
        <EducationSection reduced={prefersReducedMotion} />
      </MorphReveal>
      <LandingSectionDivider reduced={Boolean(prefersReducedMotion)} />
      <MorphReveal reduced={prefersReducedMotion}>
        <TestimonialsSection reduced={prefersReducedMotion} />
      </MorphReveal>
      <LandingSectionDivider reduced={Boolean(prefersReducedMotion)} />
      <MorphReveal reduced={prefersReducedMotion}>
        <ActivityStrip />
      </MorphReveal>
      <LandingSectionDivider reduced={Boolean(prefersReducedMotion)} />
      <MorphReveal reduced={prefersReducedMotion}>
        <LandingPricingSection reduced={prefersReducedMotion} />
      </MorphReveal>
    </LandingShell>
  );
}
