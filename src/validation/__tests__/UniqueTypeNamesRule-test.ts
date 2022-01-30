import type { IrisSchema } from '../../type/schema';

import { getSDLValidationErrors } from '../../utils/harness';

import { UniqueTypeNamesRule } from '../rules/UniqueTypeNamesRule';

function expectSDLErrors(sdlStr: string, schema?: IrisSchema) {
  return expect(getSDLValidationErrors(schema, UniqueTypeNamesRule, sdlStr));
}

function expectValidSDL(sdlStr: string, schema?: IrisSchema) {
  expectSDLErrors(sdlStr, schema).toEqual([]);
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

  it('types named the same', () => {
    expectSDLErrors(`
      resolver Foo
      data Foo
      data Foo
    `).toEqual([
      {
        message: 'There can be only one type named "Foo".',
        locations: [
          { line: 2, column: 16 },
          { line: 3, column: 12 },
        ],
      },
      {
        message: 'There can be only one type named "Foo".',
        locations: [
          { line: 2, column: 16 },
          { line: 4, column: 12 },
        ],
      },
    ]);
  });
});
