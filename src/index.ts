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

export const irisSchema = (src: string, resolvers?: ResolverMap) =>
  toGQLSchema(buildSchema(src), resolvers);
