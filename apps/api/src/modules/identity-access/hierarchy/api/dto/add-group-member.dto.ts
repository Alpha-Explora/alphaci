import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

/**
 * Body for POST /groups/:groupId/members — a lead granting membership
 * directly. There is no invitation step and nothing for the recipient to
 * accept.
 *
 * There is no team role to pick: what a person may do in a team comes from
 * their app role (lead and admin manage; QA and Developers do not), which an
 * admin changes in the Admin Console.
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
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  deliveryProjectIds?: string[];
}
