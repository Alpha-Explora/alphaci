export type CapabilityMaturity = 'stable' | 'limited' | 'not-implemented';

/**
 * How an available capability behaves on one deployment (ADR-0024). The
 * default is the behavior every deployment had before the option existed.
 */
export interface CapabilityOptionRecord {
  readonly key: string;
  readonly env: string;
  readonly description: string;
  readonly values: readonly string[];
  readonly default: string;
}

export interface CapabilityRecord {
  readonly key: string;
  readonly context: string;
  readonly description: string;
  readonly maturity: CapabilityMaturity;
  readonly configuration: string;
  readonly configurationFlags: readonly string[];
  readonly requires: readonly string[];
  readonly options?: readonly CapabilityOptionRecord[];
}
