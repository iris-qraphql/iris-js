import type { IrisSchema } from '../../type/schema';

import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { UniqueNamesRule } from '../rules/UniqueNamesRule';

function expectSDLErrors(sdlStr: string, schema?: IrisSchema) {
  return expect(getSDLValidationErrors(schema, UniqueNamesRule, sdlStr));
}

function expectValidSDL(sdlStr: string, schema?: IrisSchema) {
  expectSDLErrors(sdlStr, schema).toEqual([]);
}

describe('Validate: Unique type names', () => {
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

describe('Validate: Unique field definition names', () => {
  it('no fields', () => {
    expectValidSDL(`
      resolver SomeObject
      data SomeInputObject
    `);
  });

  it('one field', () => {
    expectValidSDL(`
      resolver SomeObject = {
        foo: String
      }

      data SomeInputObject = {
        foo: String
      }
    `);
  });

  it('multiple fields', () => {
    expectValidSDL(`
      resolver SomeObject = {
        foo: String
        bar: String
      }
  
      data SomeInputObject = {
        foo: String
        bar: String
      }
    `);
  });

  it('duplicate fields inside the same type definition', () => {
    expectSDLErrors(`
      resolver SomeObject = {
        foo: String
        bar: String
        foo: String
      }

      data SomeInputObject = {
        foo: String
        bar: String
        foo: String
      }
    `).toEqual([
      {
        message: 'Field "SomeObject.foo" can only be defined once.',
        locations: [
          { line: 3, column: 9 },
          { line: 5, column: 9 },
        ],
      },
      {
        message: 'Field "SomeInputObject.foo" can only be defined once.',
        locations: [
          { line: 9, column: 9 },
          { line: 11, column: 9 },
        ],
      },
    ]);
  });
});
