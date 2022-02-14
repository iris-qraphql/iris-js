/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */
import { graphql } from 'graphql';

import { toGQLSchema } from './transpiling/toGQLSchema';
import { buildSchema } from './types/schema';

export { version, versionInfo } from './version';

export const irisSchema = (src: string) => toGQLSchema(buildSchema(src));

export const iris = graphql;
