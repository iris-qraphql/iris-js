/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */
import { toGQLSchema } from './transpiling/toGQLSchema';
import { buildSchema } from './types/schema';

export { graphql } from 'graphql';
export { version, versionInfo } from './version';

export const irisSchema = (src: string) => toGQLSchema(buildSchema(src));
