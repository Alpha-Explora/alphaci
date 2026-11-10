import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Refusals the web app can tell apart. Each factory returns the Nest exception
 * for its status with a body `{ statusCode, error, code, message, ...extras }`;
 * AllExceptionsFilter sends that body as it is. The `code` is the contract: the
 * message is for people and may be reworded, the code may not. A client
 * switches on the code, and the facts it needs (who loses access, which Project
 * is missing a Feature) ride in `extras`.
 *
 * Codes are UPPER_SNAKE_CASE, name the situation rather than the status, and are
 * never reused for a different situation. The envelope fields cannot be
 * overridden by `extras`.
 */
export type ErrorExtras = Readonly<Record<string, unknown>>;

function body(
  statusCode: number,
  error: string,
  code: string,
  message: string,
  extras: ErrorExtras = {},
): Record<string, unknown> {
  return { ...extras, statusCode, error, code, message };
}

export const badRequest = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): BadRequestException =>
  new BadRequestException(body(400, 'Bad Request', code, message, extras));

export const unauthorized = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): UnauthorizedException =>
  new UnauthorizedException(body(401, 'Unauthorized', code, message, extras));

export const forbidden = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): ForbiddenException =>
  new ForbiddenException(body(403, 'Forbidden', code, message, extras));

export const notFound = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): NotFoundException =>
  new NotFoundException(body(404, 'Not Found', code, message, extras));

export const conflict = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): ConflictException =>
  new ConflictException(body(409, 'Conflict', code, message, extras));

export const unprocessable = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): UnprocessableEntityException =>
  new UnprocessableEntityException(
    body(422, 'Unprocessable Entity', code, message, extras),
  );

export const unavailable = (
  code: string,
  message: string,
  extras?: ErrorExtras,
): ServiceUnavailableException =>
  new ServiceUnavailableException(
    body(503, 'Service Unavailable', code, message, extras),
  );
