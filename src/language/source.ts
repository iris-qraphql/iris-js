import { Location, Source } from 'graphql/language';

import { instanceOf } from '../jsutils/instanceOf';

export { Source, Location };
/**
 * Test if the given value is a Source object.
 *
 * @internal
 */
export function isSource(source: unknown): source is Source {
  return instanceOf(source, Source);
}
