import type { GraphQLSchema } from '../../type/schema';

import { getSDLValidationErrors } from '../__mocha__/harness';
import { KnownTypeNamesRule } from '../rules/KnownTypeNamesRule';

function getSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return getSDLValidationErrors(schema, KnownTypeNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expect(getSDLErrors(sdlStr, schema)).toEqual([]);
}

describe('Validate: Known type names', () => {
  describe('within SDL', () => {
    it('use standard types', () => {
      expectValidSDL(`
        resolver Query = {
          string: String
          int: Int
          float: Float
          boolean: Boolean
          id: ID
          introspectionType: __EnumValue
        }
      `);
    });

    it('reference types defined inside the same document', () => {
      expectValidSDL(`
        resolver SomeUnion = SomeObject | AnotherObject

        resolver SomeObject = {
          someScalar(arg: SomeInputObject): SomeScalar
        }

        resolver AnotherObject = {
          foo(arg: SomeInputObject): String
        }

        data  SomeInputObject {
          someScalar: SomeScalar
        }

        data SomeScalar = String

        resolver Query = {
          someUnion: SomeUnion
          someScalar: SomeScalar
          someObject: SomeObject
        }
      `);
    });

    it('unknown type references', () => {
      expect(
        getSDLErrors(`
        resolver A
        resolver B

        resolver SomeObject = {
          e(d: D): E
        }

        resolver SomeUnion = F | G

        data SomeInput {
          j: J
        }

        directive @SomeDirective(k: K) on QUERY
      `),
      ).toMatchSnapshot();
    });
  });
});
