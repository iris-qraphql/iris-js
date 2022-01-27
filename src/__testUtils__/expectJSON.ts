import { expect } from 'chai';

import { toJSONDeep } from '../utils/toJSONDeep';

export function expectJSON(actual: unknown) {
  const actualJSON = toJSONDeep(actual);

  return {
    toDeepEqual(expected: unknown) {
      const expectedJSON = toJSONDeep(expected);
      expect(actualJSON).to.deep.equal(expectedJSON);
    },
    toDeepNestedProperty(path: string, expected: unknown) {
      const expectedJSON = toJSONDeep(expected);
      expect(actualJSON).to.deep.nested.property(path, expectedJSON);
    },
  };
}
