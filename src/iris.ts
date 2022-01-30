import type { GraphQLArgs } from 'graphql';
import { graphql } from 'graphql';
import type { ExecutionResult } from 'graphql/execution';

import type { IrisSchema } from './type/schema';
import { validateSchema } from './type/validate';

import { toGQLSchema } from './transpile/toGQLSchema';

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
