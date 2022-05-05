/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */
import type { ResolverMap } from './transpiling/toGQLSchema';
import { toGQLSchema } from './transpiling/toGQLSchema';
import { buildSchema } from './types/schema';

export { graphql } from 'graphql';
export { version, versionInfo } from './version';

type Config = {
  typeDefs: string;
  resolvers?: ResolverMap;
};

export const irisSchema = ({ typeDefs, resolvers }: Config) =>
  toGQLSchema(buildSchema(typeDefs), resolvers);
