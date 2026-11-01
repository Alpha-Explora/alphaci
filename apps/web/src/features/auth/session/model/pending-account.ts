export interface PendingAccount {
  pending: boolean;
  login?: string;
  archivedAt?: string;
  purgeAt?: string;
  retentionDays?: number;
}
