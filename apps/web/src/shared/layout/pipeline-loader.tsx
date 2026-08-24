"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

import { DitherBackground } from "@/shared/layout/dither-background";

interface PipelineLoaderProps {
  label?: string;
}

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

export function PipelineLoader({
  label = "Loading",
}: Readonly<PipelineLoaderProps>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="pipeline-loader-shell">
      <DitherBackground className="pipeline-loader-dither" />

      <section className="pipeline-loader-center" role="status" aria-label={label}>
        <motion.div
          className="pipeline-loader-mark"
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.42, ease: EASE_OUT }}
        >
          <div className="pipeline-loader-logo-frame">
            <Image
              src="/brand-logo.png"
              alt="ALPHACI"
              width={220}
              height={72}
              unoptimized
              priority
              className="pipeline-loader-logo-image"
            />
          </div>
        </motion.div>

        <motion.div
          className="pipeline-loader-copy"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: EASE_OUT, delay: 0.08 }}
        >
          <p className="pipeline-loader-label">{label}</p>
          <p className="pipeline-loader-subtitle">Preparing your workspace</p>
        </motion.div>

        <motion.div
          className="pipeline-loader-progress"
          initial={prefersReducedMotion ? false : { opacity: 0, scaleX: 0.92 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.36, ease: EASE_OUT, delay: 0.16 }}
          aria-hidden="true"
        >
          <motion.span
            className="pipeline-loader-progress-bar"
            animate={
              prefersReducedMotion
                ? false
                : {
                    x: ["-35%", "110%"],
                  }
            }
            transition={{ duration: 1.55, ease: "easeInOut", repeat: Infinity }}
          />
        </motion.div>
      </section>
    </main>
  );
}
