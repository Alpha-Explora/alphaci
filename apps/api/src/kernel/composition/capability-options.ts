import { CAPABILITIES } from './capability-registry.js';
import type {
  CapabilityOptionRecord,
  CapabilityRecord,
} from './capability-record.types.js';
import type { CapabilityKey } from './capability-types.js';

/**
 * Capability options (ADR-0023): how an available capability behaves on this
 * deployment, read once at boot.
 *
 * An option is deployment configuration, the layer after the client policy.
 * It never enables a capability, and nothing selects a value by comparing a
 * client id: a deployment that sets nothing gets the default, which is the
 * behavior every deployment had before the option existed.
 */

type RegistryRecord = (typeof CAPABILITIES)[number];

type OptionsOf<K extends CapabilityKey> =
  Extract<RegistryRecord, { readonly key: K }> extends {
    readonly options: readonly (infer Option)[];
  }
    ? Option
    : never;

/** Option keys the registry declares for one capability. */
export type CapabilityOptionKey<K extends CapabilityKey> =
  OptionsOf<K> extends { readonly key: infer Key extends string } ? Key : never;

/** The closed set of values one option accepts. */
export type CapabilityOptionValue<
  K extends CapabilityKey,
  N extends CapabilityOptionKey<K>,
> =
  Extract<OptionsOf<K>, { readonly key: N }> extends {
    readonly values: readonly (infer Value extends string)[];
  }
    ? Value
    : never;

/** Resolved values, keyed by capability, for capabilities that declare options. */
export type CapabilityOptionValues = Readonly<
  Partial<Record<CapabilityKey, Readonly<Record<string, string>>>>
>;

type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * Read every declared option from the environment.
 *
 * Unset or blank resolves to the default. Any other value outside the
 * option's list stops the boot, the same rule as ALPHACI_DEPLOYMENT_MODE: a
 * typo must not quietly run the default behavior on a deployment that asked
 * for another one.
 */
export function parseCapabilityOptions(
  env: EnvLike,
  registry: readonly CapabilityRecord[] = CAPABILITIES,
): CapabilityOptionValues {
  const resolved: Partial<Record<string, Readonly<Record<string, string>>>> =
    {};
  for (const record of registry) {
    if (record.options === undefined || record.options.length === 0) continue;
    resolved[record.key] = Object.fromEntries(
      record.options.map((option) => [option.key, readOption(env, option)]),
    );
  }
  return resolved;
}

function readOption(env: EnvLike, option: CapabilityOptionRecord): string {
  const raw = (env[option.env] ?? '').trim().toLowerCase();
  if (raw === '') return option.default;
  if (!option.values.includes(raw)) {
    throw new Error(
      `[config] Invalid ${option.env}: '${raw}'. ` +
        `Allowed values: ${option.values.join(', ')}. ` +
        `Default when unset: ${option.default}.`,
    );
  }
  return raw;
}
