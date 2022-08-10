/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */

import { toTSDefinitions } from './printing/print-ts';
import { buildSchema } from './types/schema';

export { version, versionInfo } from './version';

export const iris = (src: string) => toTSDefinitions(buildSchema(src));
