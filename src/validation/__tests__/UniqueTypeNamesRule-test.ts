import type { GraphQLSchema } from '../../type/schema';

import { expectSDLValidationErrors } from '../__mocha__/harness';
import { UniqueTypeNamesRule } from '../rules/UniqueTypeNamesRule';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(schema, UniqueTypeNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
}

describe('Validate: Unique type names', () => {
  it('no types', () => {
    expectValidSDL(`
      directive @test on SCHEMA
    `);
  });

  it('one type', () => {
    expectValidSDL(`
      resolver Foo
    `);
  });

  it('many types', () => {
    expectValidSDL(`
      resolver Foo
      resolver Bar
      resolver Baz
    `);
  });

  it('type and non-type definitions named the same', () => {
    expectValidSDL(`
      query Foo { __typename }
      fragment Foo on Query { __typename }
      directive @Foo on SCHEMA

      resolver Foo
    `);
  });

  it('types named the same', () => {
    expectSDLErrors(`
      resolver Foo
      scalar Foo
      data Foo
    `).toDeepEqual([
      {
        message: 'There can be only one type named "Foo".',
        locations: [
          { line: 2, column: 16 },
          { line: 3, column: 14 },
        ],
      },
      {
        message: 'There can be only one type named "Foo".',
        locations: [
          { line: 2, column: 16 },
          { line: 4, column: 12 },
        ],
      }
    ]);
  });

});
