export type PlatformRoleContract = 'super_admin';
export type PlatformAppRoleContract = 'admin' | 'lead' | 'qa' | 'member';

export interface PlatformAdminContract {
  userId: string;
  login: string;
  role: PlatformRoleContract;
  grantedBy: string | null;
  grantedAt: string;
}
