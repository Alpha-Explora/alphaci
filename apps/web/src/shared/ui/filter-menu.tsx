"use client";

import "./filter-menu.css";

export interface FilterMenuOption<T extends string> {
  id: T;
  label: string;
  /** Shown beside the label; omitted where a filter has no count. */
  count?: number;
}

/**
 * One pill that opens the filter choices: "Filter · <active> · <count>",
 * closing again once a choice is made. Used wherever a list narrows by one
 * value (a run's verifications, the Audit trail's sources).
 */
export function FilterMenu<T extends string>({
  options,
  value,
  onChange,
  label = "Filter",
  ariaLabel,
  className,
}: Readonly<{
  options: ReadonlyArray<FilterMenuOption<T>>;
  value: T;
  onChange: (next: T) => void;
  label?: string;
  ariaLabel: string;
  className?: string;
}>) {
  const active = options.find((option) => option.id === value) ?? options[0];
  if (!active) return null;
  return (
    <details className={className ? `filter-menu ${className}` : "filter-menu"}>
      <summary className="filter-menu__trigger">
        <span>{label}</span>
        <strong className="filter-menu__active">{active.label}</strong>
        {active.count === undefined ? null : <span className="filter-menu__count">{active.count}</span>}
      </summary>
      <div className="filter-menu__options" role="group" aria-label={ariaLabel}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="filter-menu__option"
            data-filter={option.id}
            aria-pressed={option.id === value}
            onClick={(event) => {
              onChange(option.id);
              const menu = event.currentTarget.closest("details");
              if (menu) menu.open = false;
            }}
          >
            {option.label}
            {option.count === undefined ? null : <span className="filter-menu__count">{option.count}</span>}
          </button>
        ))}
      </div>
    </details>
  );
}
