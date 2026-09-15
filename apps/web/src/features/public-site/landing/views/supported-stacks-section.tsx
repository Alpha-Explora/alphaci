"use client";

import { motion, useReducedMotion } from "framer-motion";

import { StackLogo, type StackLogoName } from "@/shared/ui/brand";

const STACKS: Array<{ name: StackLogoName }> = [
  { name: "Next.js" },
  { name: "React" },
  { name: "NestJS" },
  { name: "Node.js" },
];

// With only 4 stacks, one set is narrower than the viewport — repeat it so the
// scrolling half is always full, then double that for the seamless -50% loop.
const BASE_REPEATS = 3;
const BASE_STACKS = Array.from({ length: BASE_REPEATS }, () => STACKS).flat();
const LOOPED_STACKS = [...BASE_STACKS, ...BASE_STACKS];

export function SupportedStacksSection() {
  const prefersReducedMotion = useReducedMotion();
  const stacks = prefersReducedMotion ? STACKS : LOOPED_STACKS;

  return (
    <section className="relative bg-[var(--bg-soft)] py-8" aria-label="Supported Ecosystems">
      <p className="mb-5 mt-8 text-center font-mono text-[0.85rem] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
        Supported stacks
      </p>

      <div className="relative overflow-hidden py-[0.9rem] pb-[1.6rem] [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <motion.div
          className={prefersReducedMotion ? "flex w-auto flex-wrap justify-center gap-5" : "flex w-max gap-5 will-change-transform"}
          animate={prefersReducedMotion ? undefined : { x: ["0%", "calc(-50% - 0.625rem)"] }}
          transition={prefersReducedMotion ? undefined : { duration: 38, ease: "linear", repeat: Infinity }}
        >
          {stacks.map((stack, index) => {
            const isDuplicate = index >= STACKS.length;

            return (
              <div
                key={`${stack.name}-${index}`}
                className="inline-flex min-w-[10rem] flex-none items-center justify-center gap-3 rounded-xl border border-blue-400/15 bg-[rgba(24,36,58,0.72)] px-[2rem] py-[1.2rem] font-mono text-[1.1rem] font-bold tracking-normal text-[#d3d9e2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-200 hover:bg-[rgba(32,48,74,0.85)]"
                data-stack-badge="true"
                data-stack-name={stack.name}
                aria-hidden={isDuplicate ? "true" : undefined}
              >
                <StackLogo name={stack.name} className="size-6 shrink-0" />
                {stack.name}
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}


