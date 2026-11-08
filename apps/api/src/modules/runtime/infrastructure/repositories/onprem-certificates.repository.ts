import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '#kernel/db/database.service';

/** A workspace certificate as the API lists it; never the key. */
export interface OnpremCertificate {
  id: string;
  name: string;
  hostnames: string[];
  issuer: string;
  notBefore: string;
  notAfter: string;
  sha256: string;
  createdAt: string;
  /** Active assignments whose bound address uses it. */
  inUse: number;
}

interface CertificateRow {
  id: string;
  name: string;
  hostnames: string[];
  issuer: string;
  not_before: Date;
  not_after: Date;
  sha256: string;
  created_at: Date;
  in_use?: string | number;
}

/** Active assignments whose bound address uses certificate `c.id`. */
const IN_USE = `(SELECT COUNT(*) FROM env_provisioning.onprem_hosts h
   WHERE h.revoked_at IS NULL
     AND h.assignment_config->'ingress'->>'mode' = 'bound'
     AND h.assignment_config->'ingress'->'binding'->'tls'->>'certificateId' = c.id::text)`;

const certificate = (row: CertificateRow): OnpremCertificate => ({
  id: row.id,
  name: row.name,
  hostnames: row.hostnames,
  issuer: row.issuer,
  notBefore: row.not_before.toISOString(),
  notAfter: row.not_after.toISOString(),
  sha256: row.sha256,
  createdAt: row.created_at.toISOString(),
  inUse: Number(row.in_use ?? 0),
});

@Injectable()
export class OnpremCertificatesRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(workspaceId: string): Promise<OnpremCertificate[]> {
    const result = await this.db.query<CertificateRow>(
      `SELECT c.*, ${IN_USE} AS in_use FROM env_provisioning.onprem_certificates c
        WHERE c.workspace_id=$1 AND c.deleted_at IS NULL ORDER BY c.not_after, c.name`,
      [workspaceId],
    );
    return result.rows.map(certificate);
  }

  async create(input: {
    workspaceId: string;
    userId: string;
    name: string;
    hostnames: string[];
    issuer: string;
    notBefore: Date;
    notAfter: Date;
    sha256: string;
    certificatePem: string;
    privateKeyCiphertext: string;
  }): Promise<OnpremCertificate> {
    return this.db.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO env_provisioning.onprem_workspace_lifecycle(workspace_id) VALUES($1) ON CONFLICT DO NOTHING`,
        [input.workspaceId],
      );
      const lifecycle = await client.query<{ deleted_at: Date | null }>(
        `SELECT deleted_at FROM env_provisioning.onprem_workspace_lifecycle WHERE workspace_id=$1 FOR SHARE`,
        [input.workspaceId],
      );
      if (lifecycle.rows[0]?.deleted_at)
        throw new ConflictException('Workspace has been deleted.');
      const created = await client.query<CertificateRow>(
        `INSERT INTO env_provisioning.onprem_certificates
           (workspace_id,name,hostnames,issuer,not_before,not_after,sha256,certificate_pem,private_key_ciphertext,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          input.workspaceId,
          input.name,
          input.hostnames,
          input.issuer,
          input.notBefore,
          input.notAfter,
          input.sha256,
          input.certificatePem,
          input.privateKeyCiphertext,
          input.userId,
        ],
      );
      return certificate(created.rows[0]!);
    });
  }

  /** False when there is no such live certificate in the workspace. */
  async remove(workspaceId: string, id: string): Promise<boolean> {
    return this.db.withTransaction(async (client) => {
      const found = await client.query<CertificateRow>(
        `SELECT c.*, ${IN_USE} AS in_use FROM env_provisioning.onprem_certificates c
          WHERE c.id=$1 AND c.workspace_id=$2 AND c.deleted_at IS NULL FOR UPDATE`,
        [id, workspaceId],
      );
      const row = found.rows[0];
      if (!row) return false;
      if (Number(row.in_use ?? 0) > 0)
        throw new ConflictException(
          'Environments still use this certificate. Choose another certificate for them first.',
        );
      await client.query(
        `UPDATE env_provisioning.onprem_certificates SET deleted_at=NOW() WHERE id=$1`,
        [id],
      );
      return true;
    });
  }

  /** What assignment validation needs; null when not a live certificate of the workspace. */
  async forAssignment(
    workspaceId: string,
    id: string,
  ): Promise<{ name: string; hostnames: string[]; notAfter: Date } | null> {
    const result = await this.db.query<CertificateRow>(
      `SELECT name, hostnames, not_after FROM env_provisioning.onprem_certificates
        WHERE id=$1 AND workspace_id=$2 AND deleted_at IS NULL`,
      [id, workspaceId],
    );
    const row = result.rows[0];
    return row
      ? { name: row.name, hostnames: row.hostnames, notAfter: row.not_after }
      : null;
  }

  /** What readiness needs, deleted certificates included. */
  async readinessFacts(
    id: string,
  ): Promise<{ name: string; notAfter: Date; deleted: boolean } | null> {
    const result = await this.db.query<{
      name: string;
      not_after: Date;
      deleted: boolean;
    }>(
      `SELECT name, not_after, deleted_at IS NOT NULL AS deleted FROM env_provisioning.onprem_certificates WHERE id=$1`,
      [id],
    );
    const row = result.rows[0];
    return row
      ? { name: row.name, notAfter: row.not_after, deleted: row.deleted }
      : null;
  }

  /**
   * The files a machine fetches, only while one of its active assignments
   * serves a bound address with this certificate. Null otherwise.
   */
  async forMachine(
    machineId: string,
    id: string,
  ): Promise<{
    sha256: string;
    certificatePem: string;
    privateKeyCiphertext: string;
  } | null> {
    const result = await this.db.query<{
      sha256: string;
      certificate_pem: string;
      private_key_ciphertext: string;
    }>(
      `SELECT c.sha256, c.certificate_pem, c.private_key_ciphertext
         FROM env_provisioning.onprem_certificates c
        WHERE c.id=$2 AND c.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM env_provisioning.onprem_hosts h
                       WHERE h.machine_id=$1 AND h.revoked_at IS NULL
                         AND h.assignment_config->'ingress'->>'mode' = 'bound'
                         AND h.assignment_config->'ingress'->'binding'->'tls'->>'certificateId' = c.id::text)`,
      [machineId, id],
    );
    const row = result.rows[0];
    return row
      ? {
          sha256: row.sha256,
          certificatePem: row.certificate_pem,
          privateKeyCiphertext: row.private_key_ciphertext,
        }
      : null;
  }
}
