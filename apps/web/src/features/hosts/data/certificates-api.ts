import { request } from '@/shared/api/request';
import type { Certificate, CertificateUpload } from '../model/address-binding';
const path = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/onprem-certificates`;

/** The workspace's uploaded certificates. Private keys are never returned. */
export function listCertificates(workspaceId: string, signal?: AbortSignal) {
  return request<Certificate[]>(path(workspaceId), { signal });
}

export function uploadCertificate(
  workspaceId: string,
  upload: CertificateUpload,
) {
  return request<Certificate>(path(workspaceId), {
    method: 'POST',
    body: JSON.stringify(upload),
  });
}

/** Refused (409) while an active assignment serves it. */
export function deleteCertificate(workspaceId: string, certificateId: string) {
  return request<void>(
    `${path(workspaceId)}/${encodeURIComponent(certificateId)}`,
    { method: 'DELETE' },
  );
}
