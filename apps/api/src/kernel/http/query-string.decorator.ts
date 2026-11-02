import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';

import { singleQueryValue } from './single-query-value';

const queryStringParam = createParamDecorator(
  (name: string, context: ExecutionContext): string | undefined =>
    singleQueryValue(context.switchToHttp().getRequest<Request>().query[name]),
);

/**
 * One query parameter as a string, or undefined when it is absent or is not a
 * single string (`?a=1&a=2` is an array, `?a[b]=1` an object). Use it instead
 * of `@Query('name')`, whose `string` type lies for those shapes; the
 * no-named-query architecture spec enforces that.
 *
 *   list(@QueryString('branch') branch?: string)
 *
 * Also documents the parameter in Swagger, as `@Query('name')` did.
 */
export function QueryString(name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    queryStringParam(name)(target, propertyKey, parameterIndex);
    if (propertyKey === undefined) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
    if (descriptor)
      ApiQuery({ name, required: false, type: String })(
        target,
        propertyKey,
        descriptor,
      );
  };
}
