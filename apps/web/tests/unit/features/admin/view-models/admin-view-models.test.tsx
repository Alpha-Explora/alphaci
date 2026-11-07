import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { adminRepository } from '../../../../../src/features/admin/data/admin-repository';
import type {
  AdminUserDetail,
  AdminUsersPage,
  FeedbackRecord,
} from '../../../../../src/features/admin/model/admin-types';
import { useAdminFeedbackViewModel } from '../../../../../src/features/admin/feedback/view-models/use-admin-feedback-view-model';
import { useAdminUserDetailViewModel } from '../../../../../src/features/admin/user-detail/view-models/use-admin-user-detail-view-model';
import { useAdminUsersViewModel } from '../../../../../src/features/admin/users/view-models/use-admin-users-view-model';

jest.mock('../../../../../src/features/admin/data/admin-repository', () => ({
  adminRepository: {
    users: jest.fn(),
    user: jest.fn(),
    feedback: jest.fn(),
  },
}));

const repo = adminRepository as jest.Mocked<typeof adminRepository>;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  jest.resetAllMocks();
});

/** Render a hook and hand back a getter for its latest value. */
function renderHook<T>(useHook: () => T): () => T {
  let latest: T | undefined;
  function Probe() {
    latest = useHook();
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Probe />));
  return () => latest as T;
}

/** A response the test settles by hand, so it can arrive out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const usersPage = (total: number): AdminUsersPage => ({
  items: [],
  total,
  limit: 25,
  offset: 0,
});
const userDetail = (id: string) => ({ id }) as AdminUserDetail;
const feedbackRecord = (id: string) => ({ id }) as FeedbackRecord;

describe('useAdminUsersViewModel', () => {
  function searchTwice() {
    const first = deferred<AdminUsersPage>();
    const second = deferred<AdminUsersPage>();
    repo.users
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const vm = renderHook(useAdminUsersViewModel);
    act(() => vm().setSearch('  newer  '));
    act(() => vm().submitSearch());
    expect(repo.users).toHaveBeenLastCalledWith('newer');
    return { vm, first, second };
  }

  it('keeps the newer search when the earlier one answers last', async () => {
    const { vm, first, second } = searchTwice();

    await act(async () => second.resolve(usersPage(2)));
    await act(async () => first.resolve(usersPage(1)));

    expect(vm().page?.total).toBe(2);
    expect(vm().status).toBe('ready');
  });

  it('ignores a failure from a search that was replaced', async () => {
    const { vm, first, second } = searchTwice();

    await act(async () => second.resolve(usersPage(2)));
    await act(async () => first.reject(new Error('slow')));

    expect(vm().error).toBeNull();
    expect(vm().status).toBe('ready');
  });

  it('reports a failure and loads again on retry', async () => {
    repo.users
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(usersPage(3));
    const vm = renderHook(useAdminUsersViewModel);
    await act(async () => {});
    expect(vm().status).toBe('error');
    expect(vm().error).toBe('Could not load users.');

    await act(async () => vm().retry());

    expect(vm().status).toBe('ready');
    expect(vm().page?.total).toBe(3);
  });
});

describe('useAdminUserDetailViewModel', () => {
  it('keeps the newer user when the earlier one answers last', async () => {
    const first = deferred<AdminUserDetail>();
    const second = deferred<AdminUserDetail>();
    repo.user
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let openUser: (id: string) => void = () => {};
    const vm = renderHook(function useOpenedUser() {
      const [id, setId] = useState('first');
      openUser = setId;
      return useAdminUserDetailViewModel(id);
    });

    act(() => openUser('second'));
    await act(async () => second.resolve(userDetail('second')));
    await act(async () => first.resolve(userDetail('first')));

    expect(vm().detail?.id).toBe('second');
  });
});

describe('useAdminFeedbackViewModel', () => {
  it('keeps the newer filter when the earlier one answers last', async () => {
    const first = deferred<FeedbackRecord[]>();
    const second = deferred<FeedbackRecord[]>();
    repo.feedback
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const vm = renderHook(useAdminFeedbackViewModel);

    act(() => vm().setFilter('resolved'));
    await act(async () => second.resolve([feedbackRecord('newer')]));
    await act(async () => first.resolve([feedbackRecord('older')]));

    expect(vm().items.map((item) => item.id)).toEqual(['newer']);
  });
});
