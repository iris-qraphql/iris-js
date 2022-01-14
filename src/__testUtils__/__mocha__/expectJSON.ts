import { expect } from 'chai';
import { toJSONDeep } from '../../jsutils/toJSONDeep';

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

export function expectToThrowJSON(fn: () => unknown) {
  function mapException(): unknown {
    try {
      return fn();
    } catch (error) {
      throw toJSONDeep(error);
    }
  }

  return expect(mapException).to.throw();
}
