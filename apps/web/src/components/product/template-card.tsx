"use client";

import { motion } from "framer-motion";

import type { CatalogTemplate } from "@/lib/api/contracts";

interface TemplateCardProps {
  template: CatalogTemplate;
  selected: boolean;
  onSelect: (template: CatalogTemplate) => void;
  reducedMotion: boolean;
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
              y: -6,
              rotateX: 2,
              rotateY: -2,
            }
      }
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
    >
      <div className="template-card-headline">
        <p className="template-stack-badge">{template.stack.toUpperCase()}</p>
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
