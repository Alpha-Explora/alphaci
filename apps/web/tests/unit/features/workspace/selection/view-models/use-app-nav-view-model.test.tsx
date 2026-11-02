import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { WorkspaceProvider } from '../../../../../../src/features/workspace/selection/views/workspace-selection-context';
import { useAppNavViewModel } from '../../../../../../src/features/workspace/selection/view-models/use-app-nav-view-model';
import type { WorkspaceSummary } from '../../../../../../src/features/workspace/selection/model/workspace-types';

jest.mock('next/navigation', () => ({ usePathname: () => '/teams' }));
let mockHostAvailability = 'disabled';
jest.mock('../../../../../../src/features/hosts/availability', () => ({
  useHostAvailability: () => mockHostAvailability,
}));

const ALL_ON = {
  status: 'ready',
  qaChecklistsEnabled: true,
  workspacesEnabled: true,
  notificationsEnabled: true,
};
let mockCapabilities: Record<string, unknown> = ALL_ON;
jest.mock('../../../../../../src/features/capabilities/current', () => ({
  ...jest.requireActual('../../../../../../src/features/capabilities/current'),
  useCapabilities: () => mockCapabilities,
}));

const mockSummaryOptions: Array<{ capability: string }> = [];
jest.mock('../../../../../../src/features/notifications/summary', () => ({
  useNotificationsSummaryViewModel: (options: { capability: string }) => {
    mockSummaryOptions.push(options);
    return { unreadCount: 0 };
  },
}));

/* The Activity entry is hidden by default (SIDEBAR_SHOWS_ACTIVITY, covered in
 * workspace-nav-rules.test.ts). These tests are about WHO would get it once it
 * is shown, so the sidebar rule is called with the entry switched on. */
jest.mock(
  '../../../../../../src/features/workspace/selection/model/workspace-types',
  () => {
    const actual = jest.requireActual<
      typeof import('../../../../../../src/features/workspace/selection/model/workspace-types')
    >(
      '../../../../../../src/features/workspace/selection/model/workspace-types',
    );
    return {
      ...actual,
      sidebarMainItems: (
        input: Parameters<typeof actual.sidebarMainItems>[0],
      ) => actual.sidebarMainItems({ ...input, showActivity: true }),
    };
  },
);

jest.mock(
  '../../../../../../src/features/workspace/selection/data/workspace-repository',
  () => ({
    getWorkspaces: jest.fn(),
    getVisibleTeams: jest.fn(),
  }),
);

import { getWorkspaces } from '../../../../../../src/features/workspace/selection/data/workspace-repository';

const mockedGetWorkspaces = getWorkspaces as jest.MockedFunction<
  typeof getWorkspaces
>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  window.localStorage.clear();
  jest.clearAllMocks();
  mockCapabilities = ALL_ON;
  mockSummaryOptions.length = 0;
});

async function mainItemsFor(
  teamRole: WorkspaceSummary['role'],
  session: {
    appRole: 'admin' | 'lead' | 'qa' | 'member';
    platformRole?: string | null;
  },
): Promise<string[]> {
  if (root) act(() => root?.unmount());
  window.localStorage.clear();
  mockedGetWorkspaces.mockResolvedValue({
    enabled: true,
    items: [
      { id: 'ws-1', name: 'Checkout squad', kind: 'team', role: teamRole },
    ],
  });
  const captured: { items: string[] } = { items: [] };
  function Probe() {
    const vm = useAppNavViewModel({ guest: false, ...session });
    // A probe exists to hand the hook's value back to the test.
    // eslint-disable-next-line react-hooks/immutability
    captured.items = vm.mainItems;
    return null;
  }
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root!.render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
  });
  return captured.items;
}

/* The /activity feed is per team. The backend derives the team role from the
 * global app role, so it opens the feed to Team leads who belong to the team
 * and to platform admins; the stored per-team role does not decide. */
describe('useAppNavViewModel Activity entry', () => {
  it('shows Hosts only when the on-prem provider is enabled', async () => {
    expect(await mainItemsFor('member', { appRole: 'member' })).not.toContain(
      'hosts',
    );
    mockHostAvailability = 'enabled';
    expect(await mainItemsFor('member', { appRole: 'member' })).toContain(
      'hosts',
    );
    mockHostAvailability = 'disabled';
  });
  it("shows Activity to the header team's Lead", async () => {
    expect(await mainItemsFor('admin', { appRole: 'lead' })).toContain(
      'activity',
    );
  });

  it('shows Activity to a Team lead whose stored team role is member', async () => {
    expect(await mainItemsFor('member', { appRole: 'lead' })).toContain(
      'activity',
    );
  });

  it('hides Activity from a Developer with a stored Delegated lead role', async () => {
    expect(
      await mainItemsFor('delegated_lead', { appRole: 'member' }),
    ).not.toContain('activity');
  });

  it('hides Activity from a QA Team member of the team', async () => {
    const items = await mainItemsFor('member', { appRole: 'qa' });
    expect(items).not.toContain('activity');
    // No Checklists either: the team page left the sidebar (SIDEBAR_SHOWS_CHECKLISTS).
    expect(items).toEqual(['home', 'projects', 'teams', 'inbox']);
  });

  it('hides Activity from a Developer', async () => {
    expect(await mainItemsFor('member', { appRole: 'member' })).not.toContain(
      'activity',
    );
  });

  it('shows Activity to a platform admin on a team they only belong to as a member', async () => {
    expect(await mainItemsFor('member', { appRole: 'admin' })).toContain(
      'activity',
    );
    expect(
      await mainItemsFor('member', {
        appRole: 'member',
        platformRole: 'super_admin',
      }),
    ).toContain('activity');
  });
});

/* /workspaces/me and every notifications route answer 404 while their
 * capability is off, so the header asks /capabilities before calling them. */
describe('useAppNavViewModel capability gating', () => {
  async function renderNav() {
    mockedGetWorkspaces.mockResolvedValue({ enabled: true, items: [] });
    const captured: { vm: ReturnType<typeof useAppNavViewModel> | null } = {
      vm: null,
    };
    const capture = (vm: ReturnType<typeof useAppNavViewModel>) => {
      captured.vm = vm;
    };
    function Probe({ onRender }: { onRender: typeof capture }) {
      onRender(
        useAppNavViewModel({ guest: false, userId: 'u-1', appRole: 'member' }),
      );
      return null;
    }
    root = createRoot(document.createElement('div'));
    await act(async () => {
      root!.render(
        <WorkspaceProvider>
          <Probe onRender={capture} />
        </WorkspaceProvider>,
      );
    });
    return captured.vm!;
  }

  it('reads workspaces and starts notifications when both are on', async () => {
    const vm = await renderNav();
    expect(mockedGetWorkspaces).toHaveBeenCalledTimes(1);
    expect(vm.workspaces.workspaces).toEqual({ enabled: true, items: [] });
    expect(mockSummaryOptions.at(-1)?.capability).toBe('enabled');
  });

  it('calls neither while /capabilities has not answered', async () => {
    mockCapabilities = { status: 'loading', qaChecklistsEnabled: false };
    const vm = await renderNav();
    expect(mockedGetWorkspaces).not.toHaveBeenCalled();
    expect(vm.workspaces.workspaces).toBeNull();
    expect(mockSummaryOptions.at(-1)?.capability).toBe('pending');
  });

  it('renders workspaces off without calling /workspaces/me when the API reports them off', async () => {
    window.localStorage.setItem('flowci.workspaceId', 'ws-stale');
    mockCapabilities = { ...ALL_ON, workspacesEnabled: false };
    const vm = await renderNav();
    expect(mockedGetWorkspaces).not.toHaveBeenCalled();
    expect(vm.status).toBe('ready');
    expect(vm.error).toBeNull();
    expect(vm.workspaces.workspaces).toEqual({ enabled: false, items: [] });
    // A team remembered from before is not kept selected.
    expect(window.localStorage.getItem('flowci.workspaceId')).toBeNull();
  });

  it('keeps the notification feed stopped when the API reports notifications off', async () => {
    mockCapabilities = { ...ALL_ON, notificationsEnabled: false };
    await renderNav();
    expect(mockSummaryOptions.at(-1)?.capability).toBe('disabled');
    expect(mockedGetWorkspaces).toHaveBeenCalledTimes(1);
  });
});
