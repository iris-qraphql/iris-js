/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */

// The Iris.js version info.
import type { GraphQLArgs } from 'graphql';
import { graphql } from 'graphql';
import type { ExecutionResult } from 'graphql/execution';

import type { IrisSchema } from './type/schema';

import { validateSchema } from './validation/validate-schema';

import { toGQLSchema } from './transpile/toGQLSchema';

export { version, versionInfo } from './version';

export {
  parse,
  parseConstValue,
  parseType,
  // Print
  print,
  // Visit
  visit,
  visitInParallel,
  DirectiveLocation,
} from './language/index';

export type IrisArgs = Omit<GraphQLArgs, 'schema'> & {
  schema: IrisSchema;
};

export const iris = ({
  schema,
  ...args
}: IrisArgs): Promise<ExecutionResult> => {
  const errors = validateSchema(schema);

  if (errors.length > 0) {
    return Promise.resolve({ errors });
  }

  return graphql({ schema: toGQLSchema(schema), ...args });
};
