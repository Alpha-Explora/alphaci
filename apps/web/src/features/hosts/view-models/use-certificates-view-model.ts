'use client';
import { useEffect, useRef, useState } from 'react';
import {
  deleteCertificate,
  listCertificates,
  uploadCertificate,
} from '../data/certificates-api';
import {
  bytesToBase64,
  certificateDraftProblem,
  certificateUpload,
  emptyCertificateDraft,
  type Certificate,
  type CertificateDraft,
} from '../model/address-binding';

type PemField = 'certificatePem' | 'privateKeyPem';

/** The workspace's TLS certificates: list, upload (.pfx or PEM), delete. */
export function useCertificatesViewModel(
  workspaceId: string,
  canManage: boolean,
) {
  const [certificates, setCertificates] = useState<Certificate[]>([]),
    [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CertificateDraft | null>(null),
    [confirmation, setConfirmation] = useState<string | null>(null);
  const [reload, setReload] = useState(0),
    [now] = useState(() => Date.now());
  const pending = useRef(false),
    scope = useRef<string | null>(workspaceId),
    // Only the newest list request lands.
    read = useRef(0);
  useEffect(() => {
    scope.current = workspaceId;
    return () => {
      scope.current = null;
    };
  }, [workspaceId]);
  useEffect(() => {
    const abort = new AbortController();
    const mine = ++read.current;
    listCertificates(workspaceId, abort.signal)
      .then((items) => {
        if (mine !== read.current) return;
        setCertificates(items);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (mine !== read.current || abort.signal.aborted) return;
        setStatus('error');
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load certificates.',
        );
      });
    return () => abort.abort();
  }, [workspaceId, reload]);

  async function perform(action: () => Promise<void>) {
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      if (scope.current === workspaceId)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Certificate operation failed. Try again in a moment.',
        );
    } finally {
      pending.current = false;
      if (scope.current === workspaceId) setBusy(false);
    }
  }
  const draftProblem = draft ? certificateDraftProblem(draft) : null;
  async function upload() {
    if (!canManage || pending.current || !draft || draftProblem) return;
    const body = certificateUpload(draft);
    await perform(async () => {
      await uploadCertificate(workspaceId, body);
      if (scope.current !== workspaceId) return;
      setDraft(null);
      setReload((value) => value + 1);
    });
  }
  async function remove(certificate: Certificate) {
    if (!canManage || pending.current || certificate.inUse > 0) return;
    if (confirmation !== certificate.id) {
      setConfirmation(certificate.id);
      return;
    }
    await perform(async () => {
      await deleteCertificate(workspaceId, certificate.id);
      if (scope.current !== workspaceId) return;
      setConfirmation(null);
      setReload((value) => value + 1);
    });
  }
  function edit(change: (old: CertificateDraft) => CertificateDraft) {
    setDraft((old) => (old ? change(old) : old));
  }
  /** Reads a .pfx/.p12 in the browser; only its base64 is sent. */
  async function choosePfx(file: File | null) {
    if (!file) return;
    const pfxBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    edit((old) =>
      old.format === 'pfx' ? { ...old, pfxBase64, fileName: file.name } : old,
    );
  }
  /** Fills a PEM field from a .pem/.crt/.key file read in the browser. */
  async function choosePemFile(field: PemField, file: File | null) {
    if (!file) return;
    const text = await file.text();
    edit((old) => (old.format === 'pem' ? { ...old, [field]: text } : old));
  }
  return {
    certificates,
    status,
    error,
    busy,
    now,
    draft,
    draftProblem,
    confirmation,
    startUpload: () => {
      setDraft(emptyCertificateDraft('pfx'));
      setConfirmation(null);
      setError(null);
    },
    cancelUpload: () => setDraft(null),
    setFormat: (format: CertificateDraft['format']) =>
      edit((old) => ({ ...emptyCertificateDraft(format), name: old.name })),
    setName: (name: string) => edit((old) => ({ ...old, name })),
    setPassword: (password: string) =>
      edit((old) => (old.format === 'pfx' ? { ...old, password } : old)),
    setPem: (field: PemField, value: string) =>
      edit((old) => (old.format === 'pem' ? { ...old, [field]: value } : old)),
    choosePfx,
    choosePemFile,
    upload,
    remove,
    cancel: () => setConfirmation(null),
  };
}
