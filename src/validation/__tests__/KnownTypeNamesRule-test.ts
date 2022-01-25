import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
  getSDLValidationErrors,
} from '../__mocha__/harness';
import { KnownTypeNamesRule } from '../rules/KnownTypeNamesRule';

function expectErrors(queryStr: string) {
  return expectValidationErrors(KnownTypeNamesRule, queryStr);
}

function expectErrorsWithSchema(schema: GraphQLSchema, queryStr: string) {
  return expectValidationErrorsWithSchema(schema, KnownTypeNamesRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function getSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return getSDLValidationErrors(schema, KnownTypeNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expect(getSDLErrors(sdlStr, schema)).toEqual([]);
}

describe('Validate: Known type names', () => {
  it('known type names are valid', () => {
    expectValid(`
      query Foo(
        $var: String
        $required: [Int!]!
        $introspectionType: __EnumValue
      ) {
        user(id: 4) {
          pets { ... on Pet { name }, ...PetFields, ... { name } }
        }
      }

      fragment PetFields on Pet {
        name
      }
    `);
  });

  it('unknown type names are invalid', () => {
    expectErrors(`
      query Foo($var: [JumbledUpLetters!]!) {
        user(id: 4) {
          name
          pets { ... on Badger { name }, ...PetFields }
        }
      }
      fragment PetFields on Peat {
        name
      }
    `).toDeepEqual([
      {
        message: 'Unknown type "JumbledUpLetters".',
        locations: [{ line: 2, column: 24 }],
      },
      {
        message: 'Unknown type "Badger".',
        locations: [{ line: 5, column: 25 }],
      },
      {
        message: 'Unknown type "Peat". Did you mean "Pet" or "Cat"?',
        locations: [{ line: 8, column: 29 }],
      },
    ]);
  });

  it('references to standard scalars that are missing in schema', () => {
    const schema = buildSchema('resolver Query = { foo: String }');
    const query = `
      query ($id: ID, $float: Float, $int: Int) {
        __typename
      }
    `;
    expectErrorsWithSchema(schema, query).toDeepEqual([
      {
        message: 'Unknown type "ID".',
        locations: [{ line: 2, column: 19 }],
      },
      {
        message: 'Unknown type "Float".',
        locations: [{ line: 2, column: 31 }],
      },
      {
        message: 'Unknown type "Int".',
        locations: [{ line: 2, column: 44 }],
      },
    ]);
  });

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

    it('does not consider non-type definitions', () => {
      expect(
        getSDLErrors(`
        query Foo { __typename }
        fragment Foo on Query { __typename }
        directive @Foo on QUERY

        resolver Query = {
          foo: Foo
        }
      `),
      ).toEqual([
        {
          message: 'Unknown type "Foo".',
          locations: [{ line: 7, column: 16 }],
        },
      ]);
    });
  });
});
