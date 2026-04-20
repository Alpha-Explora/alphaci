"use client";

import { motion } from "framer-motion";

import type { CatalogTemplate } from "@/lib/api/contracts";

interface TemplateCardProps {
  template: CatalogTemplate;
  selected: boolean;
  onSelect: (template: CatalogTemplate) => void;
  reducedMotion: boolean;
}

const stackColors: Record<string, string> = {
  nextjs: "#000000",
  nestjs: "#e0234e",
  react: "#61dafb",
  "react-native": "#9f7aea",
  expo: "#000020",
  nodejs: "#339933",
};

function StackIcon({ stack }: Readonly<{ stack: string }>) {
  const color = stackColors[stack] ?? "#2f80ed";
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      style={{ display: "inline-block", marginRight: "0.25rem", verticalAlign: "middle" }}
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export function TemplateCard({
  template,
  selected,
  onSelect,
  reducedMotion,
}: Readonly<TemplateCardProps>) {
  return (
    <motion.button
      type="button"
      className={`template-card ${selected ? "template-card-active" : ""}`}
      aria-pressed={selected}
      aria-label={`${template.name} template`}
      onClick={() => onSelect(template)}
      whileHover={
        reducedMotion
          ? undefined
          : {
              y: -2,
              scale: 1.01,
            }
      }
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
    >
      <div className="template-card-headline">
        <p className="template-stack-badge">
          <StackIcon stack={template.stack} />
          {template.stack.toUpperCase()}
        </p>
        <h3>{template.name}</h3>
      </div>
      <p className="template-card-description">{template.description}</p>
      <div className="template-tag-row">
        {template.categories.slice(0, 3).map((category) => (
          <span key={`${template.id}-${category}`} className="template-tag">
            {category}
          </span>
        ))}
      </div>
    </motion.button>
  );
}
