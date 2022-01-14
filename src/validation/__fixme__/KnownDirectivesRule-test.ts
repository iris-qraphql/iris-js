import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { KnownDirectivesRule } from '../rules/KnownDirectivesRule';

import {
  expectSDLValidationErrors,
  expectValidationErrorsWithSchema,
} from '../__mocha__/harness';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    schemaWithDirectives,
    KnownDirectivesRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(schema, KnownDirectivesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
}

const schemaWithDirectives = buildSchema(`
  type Query {
    dummy: String
  }

  directive @onQuery on QUERY
  directive @onMutation on MUTATION
  directive @onSubscription on SUBSCRIPTION
  directive @onField on FIELD
  directive @onFragmentDefinition on FRAGMENT_DEFINITION
  directive @onFragmentSpread on FRAGMENT_SPREAD
  directive @onInlineFragment on INLINE_FRAGMENT
  directive @onVariableDefinition on VARIABLE_DEFINITION
`);

const schemaWithSDLDirectives = buildSchema(`
  directive @onSchema on SCHEMA
  directive @onScalar on SCALAR
  directive @onObject on OBJECT
  directive @onFieldDefinition on FIELD_DEFINITION
  directive @onArgumentDefinition on ARGUMENT_DEFINITION
  directive @onInterface on INTERFACE
  directive @onUnion on UNION
  directive @onEnum on ENUM
  directive @onEnumValue on ENUM_VALUE
  directive @onInputObject on INPUT_OBJECT
  directive @onInputFieldDefinition on INPUT_FIELD_DEFINITION
`);

describe('Validate: Known directives', () => {
  it('with no directives', () => {
    expectValid(`
      query Foo {
        name
        ...Frag
      }

      fragment Frag on Dog {
        name
      }
    `);
  });

  it('with standard directives', () => {
    expectValid(`
      {
        human @skip(if: false) {
          name
          pets {
            ... on Dog @include(if: true) {
              name
            }
          }
        }
      }
    `);
  });

  it('with unknown directive', () => {
    expectErrors(`
      {
        human @unknown(directive: "value") {
          name
        }
      }
    `).toDeepEqual([
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 3, column: 15 }],
      },
    ]);
  });

  it('with many unknown directives', () => {
    expectErrors(`
      {
        __typename @unknown
        human @unknown {
          name
          pets @unknown {
            name
          }
        }
      }
    `).toDeepEqual([
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 3, column: 20 }],
      },
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 4, column: 15 }],
      },
      {
        message: 'Unknown directive "@unknown".',
        locations: [{ line: 6, column: 16 }],
      },
    ]);
  });

  it('with well placed directives', () => {
    expectValid(`
      query ($var: Boolean @onVariableDefinition) @onQuery {
        human @onField {
          ...Frag @onFragmentSpread
          ... @onInlineFragment {
            name @onField
          }
        }
      }

      mutation @onMutation {
        someField @onField
      }

      subscription @onSubscription {
        someField @onField
      }

      fragment Frag on Human @onFragmentDefinition {
        name @onField
      }
    `);
  });

  it('with misplaced directives', () => {
    expectErrors(`
      query ($var: Boolean @onQuery) @onMutation {
        human @onQuery {
          ...Frag @onQuery
          ... @onQuery {
            name @onQuery
          }
        }
      }

      mutation @onQuery {
        someField @onQuery
      }

      subscription @onQuery {
        someField @onQuery
      }

      fragment Frag on Human @onQuery {
        name @onQuery
      }
    `).toDeepEqual([
      {
        message: 'Directive "@onQuery" may not be used on VARIABLE_DEFINITION.',
        locations: [{ line: 2, column: 28 }],
      },
      {
        message: 'Directive "@onMutation" may not be used on QUERY.',
        locations: [{ line: 2, column: 38 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FIELD.',
        locations: [{ line: 3, column: 15 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FRAGMENT_SPREAD.',
        locations: [{ line: 4, column: 19 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on INLINE_FRAGMENT.',
        locations: [{ line: 5, column: 15 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FIELD.',
        locations: [{ line: 6, column: 18 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on MUTATION.',
        locations: [{ line: 11, column: 16 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FIELD.',
        locations: [{ column: 19, line: 12 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on SUBSCRIPTION.',
        locations: [{ column: 20, line: 15 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FIELD.',
        locations: [{ column: 19, line: 16 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FRAGMENT_DEFINITION.',
        locations: [{ column: 30, line: 19 }],
      },
      {
        message: 'Directive "@onQuery" may not be used on FIELD.',
        locations: [{ column: 14, line: 20 }],
      },
    ]);
  });

  describe('within SDL', () => {
    it('with directive defined inside SDL', () => {
      expectValidSDL(`
        type Query {
          foo: String @test
        }

        directive @test on FIELD_DEFINITION
      `);
    });

    it('with standard directive', () => {
      expectValidSDL(`
        type Query {
          foo: String @deprecated
        }
      `);
    });
  });
});
