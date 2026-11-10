import type {
  DeliveryProject,
  Group,
  GroupMember,
} from '@alphaci/api-contracts';
import { z } from 'zod';

/*
 * Runtime schemas for the hierarchy responses declared in
 * @alphaci/api-contracts. The type is the contract; the schema lets an e2e spec
 * check a real response against it. `Matches<Schema, Contract>` makes the
 * compiler fail when the two stop describing the same shape, and strictObject
 * makes a response fail when it sends a field the contract does not name, so a
 * drift in either direction shows up in this suite, not in a browser.
 */

type Matches<Schema extends z.ZodType, Contract> =
  z.output<Schema> extends Contract
    ? Contract extends z.output<Schema>
      ? true
      : never
    : never;

const timestamp = z.iso.datetime({ offset: true });

const groupRole = z.enum(['admin', 'delegated_lead', 'member', 'viewer']);
const lifecycleStatus = z.enum(['active', 'archived']);
const memberStatus = z.enum(['invited', 'active', 'removed']);
const memberAppRole = z.enum(['admin', 'lead', 'qa', 'member']);

export const GroupSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  businessUnit: z.string().nullable(),
  status: lifecycleStatus,
  archivedAt: timestamp.nullable(),
  archivedBy: z.string().nullable(),
  createdAt: timestamp,
  role: groupRole,
  memberCount: z.number().int().nonnegative(),
  systemCount: z.number().int().nonnegative(),
});

export const GroupMemberSchema = z.strictObject({
  id: z.uuid(),
  groupId: z.uuid(),
  userId: z.uuid(),
  role: groupRole,
  appRole: memberAppRole.nullable(),
  memberStatus,
  login: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  invitedBy: z.string().nullable(),
  invitedAt: timestamp.nullable(),
  removedAt: timestamp.nullable(),
  removedBy: z.string().nullable(),
  removalReason: z.string().nullable(),
  createdAt: timestamp,
});

export const DeliveryProjectSchema = z.strictObject({
  id: z.uuid(),
  systemId: z.uuid(),
  groupId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  managerId: z.string().nullable(),
  status: lifecycleStatus,
  archivedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  repositoryCount: z.number().int().nonnegative(),
});

export const _group: Matches<typeof GroupSchema, Group> = true;
export const _groupMember: Matches<typeof GroupMemberSchema, GroupMember> =
  true;
export const _deliveryProject: Matches<
  typeof DeliveryProjectSchema,
  DeliveryProject
> = true;
