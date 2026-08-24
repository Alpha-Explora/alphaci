"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function SettingsTemplate({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className="page-transition-wrapper"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: [0.25, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
