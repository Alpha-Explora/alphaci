import { HttpException } from '@nestjs/common';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
  unavailable,
  unprocessable,
} from '#kernel/http/coded-errors';

describe('coded errors', () => {
  it.each([
    ['badRequest', badRequest, 400, 'Bad Request'],
    ['unauthorized', unauthorized, 401, 'Unauthorized'],
    ['forbidden', forbidden, 403, 'Forbidden'],
    ['notFound', notFound, 404, 'Not Found'],
    ['conflict', conflict, 409, 'Conflict'],
    ['unprocessable', unprocessable, 422, 'Unprocessable Entity'],
    ['unavailable', unavailable, 503, 'Service Unavailable'],
  ] as const)(
    '%s answers with its status and a code',
    (_, make, status, error) => {
      const exception = make('SOME_CODE', 'A sentence.');

      expect(exception).toBeInstanceOf(HttpException);
      expect(exception.getStatus()).toBe(status);
      expect(exception.getResponse()).toEqual({
        statusCode: status,
        error,
        code: 'SOME_CODE',
        message: 'A sentence.',
      });
    },
  );

  it('carries the facts a client needs next to the code', () => {
    const exception = conflict(
      'MOVE_REVOKES_ACCESS',
      'Moving removes access.',
      {
        people: [{ userId: 'u1' }],
      },
    );

    expect(exception.getResponse()).toMatchObject({
      code: 'MOVE_REVOKES_ACCESS',
      people: [{ userId: 'u1' }],
    });
  });

  it('never lets an extra replace the code, message or status', () => {
    const exception = notFound('REAL_CODE', 'Real message.', {
      code: 'FAKE',
      message: 'fake',
      statusCode: 200,
    });

    expect(exception.getResponse()).toMatchObject({
      code: 'REAL_CODE',
      message: 'Real message.',
      statusCode: 404,
    });
  });
});
