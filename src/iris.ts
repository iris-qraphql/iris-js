import type { GraphQLArgs, GraphQLSchema } from 'graphql';
import { graphql } from 'graphql';
import type { ExecutionResult } from 'graphql/execution';

import type { IrisSchema } from './type/schema';
import { validateSchema } from './type/validate';

export type IrisArgs = Omit<GraphQLArgs, 'schema'> & {
  schema: IrisSchema;
};

const toGQLSchema = (schema: IrisSchema): GraphQLSchema =>
  // @ts-expect-error
  schema;

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
