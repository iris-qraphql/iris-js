import type { IrisError } from '../error';
import type { IrisSchema } from '../types/schema';

export function validateSchema(schema: IrisSchema): ReadonlyArray<IrisError> {
  return schema.__validationErrors ?? [];
}
