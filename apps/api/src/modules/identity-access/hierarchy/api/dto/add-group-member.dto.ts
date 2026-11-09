import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

import type { GrantableRole } from '../../domain/hierarchy.types';

/**
 * Body for POST /groups/:groupId/members — a lead granting membership
 * directly. There is no invitation step and nothing for the recipient to
 * accept.
 *
 * `role` is optional and defaults to 'member'. 'admin' is deliberately absent:
 * group ownership only moves via the transfer endpoint.
 *
 * `deliveryProjectIds` also makes the person a member of those Projects of
 * this team, in the same transaction. A Developer gets GitHub Write on every
 * repository of each one; without it, joining the team grants no repository
 * access.
 */
export class AddGroupMemberDto {
  @IsString()
  @MinLength(1)
  userId: string = '';

  @IsOptional()
  @IsIn(['delegated_lead', 'member', 'viewer'])
  role?: GrantableRole;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  deliveryProjectIds?: string[];
}
