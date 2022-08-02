/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */
import type { ResolverMap } from './transpiling/toTSDefinitions';
import { toGQLSchema } from './transpiling/toTSDefinitions';
import { buildSchema } from './types/schema';

export { graphql } from 'graphql';
export { version, versionInfo } from './version';

type Options = {
  resolvers?: ResolverMap;
};

export const irisSchema = (src: string, { resolvers }: Options = {}) =>
  toGQLSchema(buildSchema(src), resolvers);
