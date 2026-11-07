import { CAPABILITIES } from './capability-registry.js';
import type {
  CapabilityKey,
  CapabilityManifest,
  CapabilityRecord,
  CapabilitySet,
  ResolveCapabilitiesInput,
} from './capability-types.js';
import {
  assertManifestWithinBuildProfile,
  buildProfileCapabilityCeiling,
} from './build-profile.js';

export type CapabilityDecision =
  | { readonly key: string; readonly state: 'available' }
  | {
      readonly key: string;
      readonly state: 'unavailable';
      readonly reason:
        'build-profile' | 'edition' | 'client-policy' | 'not-implemented';
    }
  | {
      readonly key: string;
      readonly state: 'unavailable';
      readonly reason: 'configuration';
      readonly flags: readonly string[];
    }
  | {
      readonly key: string;
      readonly state: 'unavailable';
      readonly reason: 'dependency';
      readonly dependencies: readonly string[];
    };

export function resolveCapabilities(
  input: ResolveCapabilitiesInput,
): CapabilitySet {
  return explainCapabilities(input).enabled;
}

export function explainCapabilities({
  registry = CAPABILITIES,
  manifest,
  config,
  editionManifest = manifest,
}: ResolveCapabilitiesInput & {
  readonly editionManifest?: CapabilityManifest;
}): {
  readonly enabled: CapabilitySet;
  readonly decisions: readonly CapabilityDecision[];
} {
  const recordsByKey = validateRegistryAndManifest(registry, manifest);
  assertManifestWithinBuildProfile(config.composition.profile, manifest);
  if (editionManifest !== manifest)
    validateRegistryAndManifest(registry, editionManifest);
  if (
    editionManifest.edition !== manifest.edition ||
    manifest.capabilities.some(
      (key) => !editionManifest.capabilities.includes(key),
    )
  ) {
    throw new Error(
      'diagnostic edition manifest must contain the selected manifest',
    );
  }
  const ceiling = new Set<string>(
    buildProfileCapabilityCeiling(config.composition.profile),
  );
  const editionKeys = new Set<string>(editionManifest.capabilities);
  const manifestKeys = new Set<string>(manifest.capabilities);
  const denied = new Map<string, CapabilityDecision>();
  const active = new Set<CapabilityKey>();

  for (const record of registry) {
    const key = record.key;
    const reason = !ceiling.has(key)
      ? 'build-profile'
      : !editionKeys.has(key)
        ? 'edition'
        : !manifestKeys.has(key)
          ? 'client-policy'
          : record.maturity === 'not-implemented'
            ? 'not-implemented'
            : null;
    if (reason !== null) {
      denied.set(key, { key, state: 'unavailable', reason });
      continue;
    }
    const flags = record.configurationFlags.filter(
      (flag) => !readBooleanPath(config, flag),
    );
    if (flags.length > 0)
      denied.set(key, {
        key,
        state: 'unavailable',
        reason: 'configuration',
        flags,
      });
    else {
      active.add(record.key as CapabilityKey);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...active]) {
      const record = recordsByKey.get(key);
      if (
        record &&
        record.requires.some(
          (dependency) => !active.has(dependency as CapabilityKey),
        )
      ) {
        active.delete(key);
        changed = true;
      }
    }
  }

  const enabled = new Set(
    registry
      .filter(({ key }) => active.has(key as CapabilityKey))
      .map(({ key }) => key as CapabilityKey),
  );
  return {
    enabled,
    decisions: registry.map(
      (record) =>
        denied.get(record.key) ??
        (enabled.has(record.key as CapabilityKey)
          ? { key: record.key, state: 'available' }
          : {
              key: record.key,
              state: 'unavailable',
              reason: 'dependency',
              dependencies: record.requires.filter(
                (key) => !enabled.has(key as CapabilityKey),
              ),
            }),
    ),
  };
}

function validateRegistryAndManifest(
  registry: readonly CapabilityRecord[],
  manifest: CapabilityManifest,
): Map<string, CapabilityRecord> {
  const recordsByKey = new Map<string, CapabilityRecord>();
  for (const record of registry) {
    if (recordsByKey.has(record.key)) {
      throw new Error(`duplicate registry capability: ${record.key}`);
    }
    recordsByKey.set(record.key, record);
  }

  const registryPositions = new Map<string, number>();
  registry.forEach(({ key }, index) => registryPositions.set(key, index));

  const manifestKeys = new Set<string>();
  let previousPosition = -1;
  for (const key of manifest.capabilities) {
    if (!recordsByKey.has(key)) {
      throw new Error(`unknown manifest capability: ${key}`);
    }
    if (manifestKeys.has(key)) {
      throw new Error(`duplicate manifest capability: ${key}`);
    }
    manifestKeys.add(key);

    const position = registryPositions.get(key);
    if (position === undefined || position <= previousPosition) {
      throw new Error(`manifest is not in registry order: ${key}`);
    }
    previousPosition = position;
  }

  for (const record of registry) {
    for (const dependency of record.requires) {
      if (!recordsByKey.has(dependency)) {
        throw new Error(`unknown required capability: ${dependency}`);
      }
    }
  }

  const states = new Map<string, 'visiting' | 'visited'>();
  const visit = (key: string): void => {
    const state = states.get(key);
    if (state === 'visiting') {
      throw new Error(`requires cycle: ${key}`);
    }
    if (state === 'visited') return;

    states.set(key, 'visiting');
    const record = recordsByKey.get(key);
    if (record) {
      for (const dependency of record.requires) visit(dependency);
    }
    states.set(key, 'visited');
  };

  for (const record of registry) visit(record.key);

  return recordsByKey;
}

function readBooleanPath(value: AppConfigValue, path: string): boolean {
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !(segment in current)
    ) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current === true;
}

type AppConfigValue = ResolveCapabilitiesInput['config'];
