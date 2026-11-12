import type {
  CapabilityOptionKey,
  CapabilityOptionValue,
  CapabilityOptionValues,
} from './capability-options.js';
import type { CapabilityKey } from './capability-types.js';

export const CAPABILITY_OPTIONS = Symbol('CapabilityOptions');

/** This deployment's capability options (ADR-0024), resolved at boot. */
export interface CapabilityOptionsPort {
  value<K extends CapabilityKey, N extends CapabilityOptionKey<K>>(
    capability: K,
    option: N,
  ): CapabilityOptionValue<K, N>;
}

/**
 * The port over resolved values. Asking for an option the registry does not
 * declare is a programming error the types already reject, so it throws
 * rather than inventing a value.
 */
export function capabilityOptionsFrom(
  values: CapabilityOptionValues,
): CapabilityOptionsPort {
  return {
    value<K extends CapabilityKey, N extends CapabilityOptionKey<K>>(
      capability: K,
      option: N,
    ): CapabilityOptionValue<K, N> {
      const value = values[capability]?.[option];
      if (value === undefined) {
        throw new Error(
          `[composition] '${capability}' declares no option '${String(option)}'.`,
        );
      }
      return value as CapabilityOptionValue<K, N>;
    },
  };
}
