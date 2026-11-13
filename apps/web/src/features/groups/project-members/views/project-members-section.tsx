'use client';

import type { AppRole } from '@/shared/api/contracts';

import { useProjectMembersViewModel } from '../view-models/use-project-members-view-model';
import {
  ProjectMembersPanel,
  type ProjectMembersLayout,
} from './project-members-panel';

/**
 * A Project's members, with their own view-model: the Project page's panel,
 * or a block of the Project screen on /workflows (`layout="section"`).
 * Leads and admins only; it renders nothing for anyone else.
 */
export function ProjectMembersSection({
  groupId,
  deliveryProjectId,
  appRole,
  layout = 'page',
}: Readonly<{
  groupId: string;
  deliveryProjectId: string;
  appRole: AppRole | null;
  layout?: ProjectMembersLayout;
}>) {
  const vm = useProjectMembersViewModel({
    groupId,
    deliveryProjectId,
    appRole,
  });
  return <ProjectMembersPanel vm={vm} layout={layout} />;
}
