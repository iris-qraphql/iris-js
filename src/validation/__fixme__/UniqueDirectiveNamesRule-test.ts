import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { expectSDLValidationErrors } from '../__mocha__/harness';
import { UniqueDirectiveNamesRule } from '../rules/UniqueDirectiveNamesRule';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(schema, UniqueDirectiveNamesRule, sdlStr);
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
}

describe('Validate: Unique directive names', () => {
  it('no directive', () => {
    expectValidSDL(`
      type Foo
    `);
  });

  it('one directive', () => {
    expectValidSDL(`
      directive @foo on SCHEMA
    `);
  });

  it('many directives', () => {
    expectValidSDL(`
      directive @foo on SCHEMA
      directive @bar on SCHEMA
      directive @baz on SCHEMA
    `);
  });

  it('directive and non-directive definitions named the same', () => {
    expectValidSDL(`
      query foo { __typename }
      fragment foo on foo { __typename }
      type foo

      directive @foo on SCHEMA
    `);
  });

  it('directives named the same', () => {
    expectSDLErrors(`
      directive @foo on SCHEMA

      directive @foo on SCHEMA
    `).toDeepEqual([
      {
        message: 'There can be only one directive named "@foo".',
        locations: [
          { line: 2, column: 18 },
          { line: 4, column: 18 },
        ],
      },
    ]);
  });
});
