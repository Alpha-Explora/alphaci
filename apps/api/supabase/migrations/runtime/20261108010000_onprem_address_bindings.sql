-- Bound addresses: an environment served by its machine under the customer's
-- own hostname and certificate (ingress mode 'bound', the IIS binding).

-- Certificates a workspace uploaded for bound addresses. The private key is
-- stored encrypted with ENV_PROVISIONING_ENCRYPTION_KEY (AES-256-GCM, the
-- v1:iv:tag:data format) and only leaves AlphaCI to a machine that serves an
-- address using it. A deleted certificate keeps its row for history.
CREATE TABLE IF NOT EXISTS env_provisioning.onprem_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES env_provisioning.onprem_workspace_lifecycle(workspace_id),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  hostnames TEXT[] NOT NULL CHECK (cardinality(hostnames) BETWEEN 1 AND 100),
  issuer TEXT NOT NULL CHECK (char_length(issuer) <= 500),
  not_before TIMESTAMPTZ NOT NULL,
  not_after TIMESTAMPTZ NOT NULL,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  certificate_pem TEXT NOT NULL CHECK (char_length(certificate_pem) <= 65536),
  private_key_ciphertext TEXT NOT NULL CHECK (private_key_ciphertext LIKE 'v1:%'),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS onprem_certificates_workspace
  ON env_provisioning.onprem_certificates(workspace_id, created_at) WHERE deleted_at IS NULL;
ALTER TABLE env_provisioning.onprem_certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON env_provisioning.onprem_certificates FROM anon, authenticated;

-- The machine's latest report for a bound address, replaced on every heartbeat
-- like the tunnel report.
ALTER TABLE env_provisioning.onprem_hosts
  ADD COLUMN IF NOT EXISTS binding_status TEXT CHECK (binding_status IN ('starting', 'running', 'unavailable', 'failed')),
  ADD COLUMN IF NOT EXISTS binding_message TEXT CHECK (char_length(binding_message) <= 300),
  ADD COLUMN IF NOT EXISTS binding_reported_at TIMESTAMPTZ;

-- One active environment per hostname, across every workspace: two sites with
-- one name would make the proxy refuse its whole configuration.
CREATE UNIQUE INDEX IF NOT EXISTS onprem_hosts_bound_hostname
  ON env_provisioning.onprem_hosts ((lower(assignment_config->'ingress'->'binding'->>'hostname')))
  WHERE revoked_at IS NULL AND assignment_config->'ingress'->>'mode' = 'bound';
