/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */

import { toTSDefinitions } from './transpiling/toTSDefinitions';
import { buildSchema } from './types/schema';

export { graphql } from 'graphql';
export { version, versionInfo } from './version';

export const irisSchema = (src: string) => toTSDefinitions(buildSchema(src));
