import type { ClientPolicyRegistry } from '#kernel/composition/client-policy.types.js';

/**
 * Declared Enterprise policies ship with the product. Mounted JSON remains the
 * preferred deployment-specific seam when a policy should stay outside code.
 */
export const CLIENT_POLICIES: ClientPolicyRegistry = {
  /*
   * Hyphenated, not `st.peter`: CLIENT_ID_PATTERN accepts lowercase letters,
   * digits and hyphens only, so a dotted id is rejected at startup rather
   * than silently ignored. The display name carries the punctuation.
   *
   * An empty deny list is a real policy, not a missing one. This client is
   * narrowed to nothing: it sees every capability the enterprise manifest
   * declares. A key belongs here only when this client must NOT see it.
   */
  'st-peter': {
    clientId: 'st-peter',
    displayName: 'St. Peter',
    edition: 'enterprise',
    disabledCapabilities: [],
  },
  /*
   * Alpha Explora's own hosted deployment (Render API, Vercel web) for its
   * internal teams. It is a client like any other, so internal-only
   * differences are data on this record and on that deployment's settings,
   * never a branch on the client id.
   *
   * Narrowed to nothing for now: the internal deployment runs the whole
   * Enterprise manifest. Add a key only when internal must NOT see it.
   */
  'alphaexplora-internal': {
    clientId: 'alphaexplora-internal',
    displayName: 'Alpha Explora (internal)',
    edition: 'enterprise',
    disabledCapabilities: [],
  },
};
