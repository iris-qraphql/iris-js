import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { KnownTypeNamesRule } from '../rules/KnownTypeNamesRule';

function getSDLErrors(sdlStr: string) {
  return getSDLValidationErrors(KnownTypeNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string) {
  expect(getSDLErrors(sdlStr)).toEqual([]);
}

describe('Validate: Known type names', () => {
  describe('within SDL', () => {
    it('use standard types', () => {
      expectValidSDL(`
        data Query = {
          string: String
          int: Int
          float: Float
          boolean: Boolean
          id: ID
        }
      `);
    });

    it('reference types defined inside the same document', () => {
      expectValidSDL(`
        data SomeUnion = SomeObject | AnotherObject

        data SomeObject = {
          someScalar: SomeScalar
        }

        data AnotherObject = {
          foo: String
        }

        data  SomeInputObject = {
          someScalar: SomeScalar
        }

        data SomeScalar = String

        data Query = {
          someUnion: SomeUnion
          someScalar: SomeScalar
          someObject: SomeObject
        }
      `);
    });

    it('unknown type references', () => {
      expect(
        getSDLErrors(`
        data A
        data B

        data SomeObject = {
          d: D
          e: E
        }

        data SomeUnion = F | G

        data SomeInput = {
          j: J
        }

        directive @SomeDirective(k: K) on QUERY
      `),
      ).toMatchSnapshot();
    });
  });
});
