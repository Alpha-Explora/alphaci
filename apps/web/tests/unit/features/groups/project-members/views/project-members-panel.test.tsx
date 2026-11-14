import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ProjectMembersPanel } from '../../../../../../src/features/groups/project-members/views/project-members-panel';
import { useProjectMembersViewModel } from '../../../../../../src/features/groups/project-members/view-models/use-project-members-view-model';
import {
  addProjectMember,
  getProjectMembers,
} from '../../../../../../src/features/groups/data/project-members-api';
import { groupsRepository } from '../../../../../../src/features/groups/data/groups-repository';
import type { AppRole } from '../../../../../../src/shared/api/contracts';

jest.mock(
  '../../../../../../src/features/groups/data/project-members-api',
  () => ({
    addProjectMember: jest.fn(),
    getProjectMembers: jest.fn(),
    removeProjectMember: jest.fn(),
    syncProjectMembers: jest.fn(),
  }),
);
jest.mock(
  '../../../../../../src/features/groups/data/groups-repository',
  () => ({
    groupsRepository: { members: jest.fn() },
  }),
);
const capabilities = { hierarchyGithubSyncMode: 'stub' as 'stub' | 'live' };
jest.mock('../../../../../../src/features/capabilities/current', () => ({
  useCapabilities: () => capabilities,
}));

async function poll(check: () => boolean, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error('condition not met');
}

function Section({ appRole }: Readonly<{ appRole: AppRole | null }>) {
  const vm = useProjectMembersViewModel({
    groupId: 'g1',
    deliveryProjectId: 'dp1',
    appRole,
  });
  return <ProjectMembersPanel vm={vm} />;
}

const base = {
  deliveryProjectId: 'dp1',
  status: 'active' as const,
  addedBy: 'u-lead',
  createdAt: '2026-10-08T00:00:00Z',
  updatedAt: '2026-10-08T00:00:00Z',
  avatarUrl: null,
};

describe('ProjectMembersPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  const text = () => container.textContent ?? '';
  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === label,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    capabilities.hierarchyGithubSyncMode = 'stub';
    (getProjectMembers as jest.Mock).mockResolvedValue({
      items: [
        {
          ...base,
          id: 'm1',
          userId: 'u-dev',
          memberKind: 'developer',
          login: 'dana',
          name: 'Dana Dev',
        },
        {
          ...base,
          id: 'm2',
          userId: 'u-qa',
          memberKind: 'qa',
          login: 'quinn',
          name: 'Quinn QA',
        },
      ],
    });
    (groupsRepository.members as jest.Mock).mockResolvedValue([
      {
        userId: 'u-new',
        role: 'member',
        memberStatus: 'active',
        login: 'nia',
        name: 'Nia New',
        appRole: 'member',
      },
    ]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders nothing for a Developer or QA', () => {
    act(() => root.render(<Section appRole="member" />));
    expect(container.innerHTML).toBe('');
    act(() => root.render(<Section appRole="qa" />));
    expect(container.innerHTML).toBe('');
  });

  it('lists members with kind badges for a lead', async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes('Dana Dev'));
    const rows = Array.from(container.querySelectorAll('.hier-row'));
    expect(rows).toHaveLength(2);
    expect(
      rows[0]?.querySelector('.project-members__kind--developer')?.textContent,
    ).toBe('Developer');
    expect(
      rows[1]?.querySelector('.project-members__kind--qa')?.textContent,
    ).toBe('QA Team');
    expect(
      container.querySelector(
        '[aria-label="Remove Dana Dev from this Project"]',
      ),
    ).not.toBeNull();
  });

  it('hides the re-sync button while sync is stub', async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes('Dana Dev'));
    expect(button('Re-sync GitHub access')).toBeUndefined();
  });

  it('offers re-sync in live mode', async () => {
    capabilities.hierarchyGithubSyncMode = 'live';
    act(() => root.render(<Section appRole="admin" />));
    await poll(() => text().includes('Dana Dev'));
    expect(button('Re-sync GitHub access')).toBeDefined();
  });

  it('selects a Developer and a QA account and submits them together', async () => {
    jest.mocked(getProjectMembers).mockResolvedValueOnce({ items: [] });
    const teamAccount = {
      groupId: 'g1',
      role: 'member' as const,
      memberStatus: 'active' as const,
      email: null,
      avatarUrl: null,
      invitedBy: null,
      invitedAt: null,
      removedAt: null,
      removedBy: null,
      removalReason: null,
      createdAt: base.createdAt,
    };
    jest.mocked(groupsRepository.members).mockResolvedValueOnce([
      {
        ...teamAccount,
        id: 'tm1',
        userId: 'u-new',
        login: 'nia',
        name: 'Nia New',
        appRole: 'member',
      },
      {
        ...teamAccount,
        id: 'tm2',
        userId: 'u-new-qa',
        login: 'sam',
        name: 'Sam QA',
        appRole: 'qa',
      },
    ]);
    const githubAccess = { syncMode: 'stub' as const, repositoriesQueued: 0 };
    jest
      .mocked(addProjectMember)
      .mockResolvedValueOnce({
        member: {
          ...base,
          id: 'm3',
          userId: 'u-new',
          memberKind: 'developer',
          login: 'nia',
          name: 'Nia New',
        },
        githubAccess,
      })
      .mockResolvedValueOnce({
        member: {
          ...base,
          id: 'm4',
          userId: 'u-new-qa',
          memberKind: 'qa',
          login: 'sam',
          name: 'Sam QA',
        },
        githubAccess,
      });
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes('No members yet'));
    act(() => button('Add member')!.click());
    const choices = () =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          '[role="dialog"] input[type="checkbox"]',
        ),
      );
    await poll(() => choices().length === 2);
    const [developer, qa] = choices();
    expect(developer.labels?.[0]).toHaveTextContent(
      'Nia New (@nia) · Developer',
    );
    expect(qa.labels?.[0]).toHaveTextContent('Sam QA (@sam) · QA Team');
    const submit = () =>
      document.querySelector<HTMLButtonElement>(
        '[role="dialog"] button[type="submit"]',
      )!;
    expect(submit()).toBeDisabled();
    act(() => developer.click());
    act(() => qa.click());
    expect(developer).toBeChecked();
    expect(qa).toBeChecked();
    expect(submit()).toHaveTextContent('Add 2 members');
    await act(async () => submit().click());
    expect(jest.mocked(addProjectMember).mock.calls).toEqual([
      ['dp1', 'u-new'],
      ['dp1', 'u-new-qa'],
    ]);
    expect(container.querySelectorAll('.hier-row')).toHaveLength(2);
    expect(text()).not.toContain('No members yet');
  });

  it('asks for confirmation before removing', async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes('Quinn QA'));
    act(() =>
      (
        container.querySelector(
          '[aria-label="Remove Quinn QA from this Project"]',
        ) as HTMLButtonElement
      ).click(),
    );
    await poll(
      () => document.body.textContent?.includes('Remove Quinn QA?') ?? false,
    );
    expect(document.body.textContent).toContain(
      "They leave this Project's QA. Nothing changes on GitHub.",
    );
  });

  it('does not link to GitHub', async () => {
    act(() => root.render(<Section appRole="lead" />));
    await poll(() => text().includes('Dana Dev'));
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
  });

  describe('opened through a #members link', () => {
    const scrollIntoView = jest.fn();
    const original = Element.prototype.scrollIntoView;

    beforeEach(() => {
      scrollIntoView.mockClear();
      Element.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
      Element.prototype.scrollIntoView = original;
      window.location.hash = '';
    });

    it('carries the members anchor and scrolls to it once the list has loaded', async () => {
      window.location.hash = '#members';
      act(() => root.render(<Section appRole="lead" />));
      await poll(() => text().includes('Dana Dev'));
      const section = container.querySelector('section#members');
      expect(section).not.toBeNull();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(section);
    });

    it('does not scroll without the anchor', async () => {
      act(() => root.render(<Section appRole="lead" />));
      await poll(() => text().includes('Dana Dev'));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls to an empty list too', async () => {
      (getProjectMembers as jest.Mock).mockResolvedValue({ items: [] });
      window.location.hash = '#members';
      act(() => root.render(<Section appRole="lead" />));
      await poll(() => text().includes('No members yet'));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        container.querySelector('section#members'),
      );
    });

    it('scrolls again while the page below still loads, until the reader scrolls', async () => {
      const observed: Array<() => void> = [];
      const originalObserver = window.ResizeObserver;
      window.ResizeObserver = class {
        constructor(callback: () => void) {
          observed.push(callback);
        }
        observe() {}
        disconnect() {
          observed.length = 0;
        }
        unobserve() {}
      } as unknown as typeof ResizeObserver;
      try {
        window.location.hash = '#members';
        act(() => root.render(<Section appRole="lead" />));
        await poll(() => text().includes('Dana Dev'));
        expect(scrollIntoView).toHaveBeenCalledTimes(1);

        // Requirements and QA arrive and the page grows: follow it.
        act(() => observed[0]());
        expect(scrollIntoView).toHaveBeenCalledTimes(2);

        // The reader scrolls: stop following.
        act(() => {
          window.dispatchEvent(new Event('wheel'));
        });
        expect(observed).toHaveLength(0);
      } finally {
        window.ResizeObserver = originalObserver;
      }
    });
  });

  it('says "No members yet" in one line on the Project screen', async () => {
    (getProjectMembers as jest.Mock).mockResolvedValue({ items: [] });
    function ScreenSection() {
      const vm = useProjectMembersViewModel({
        groupId: 'g1',
        deliveryProjectId: 'dp1',
        appRole: 'lead',
      });
      return <ProjectMembersPanel vm={vm} layout="section" />;
    }
    act(() => root.render(<ScreenSection />));
    await poll(() => text().includes('No members yet'));
    expect(
      container.querySelector('.project-members__empty')?.textContent,
    ).toBe(
      "No members yet. Add Developers and QA Team from this Project's team.",
    );
    expect(
      container.querySelector('section#members')?.getAttribute('data-layout'),
    ).toBe('section');
  });
});
