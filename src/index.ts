/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */

// The Iris.js version info.
import type { GraphQLArgs, GraphQLSchema } from 'graphql';
import { graphql } from 'graphql';
import type { ExecutionResult } from 'graphql/execution';

import { toGQLSchema } from './transpiling/toGQLSchema';
import type { IrisSchema } from './types/schema';
import { buildSchema } from './types/schema';

export { version, versionInfo } from './version';

export type IrisArgs = Omit<GraphQLArgs, 'schema'> & {
  schema: IrisSchema;
};


export const irisGQLScema = (src: string): GraphQLSchema => 
  toGQLSchema(buildSchema(src))


export const iris = ({ schema, ...args }: IrisArgs): Promise<ExecutionResult> =>
  graphql({ schema: toGQLSchema(schema), ...args });
