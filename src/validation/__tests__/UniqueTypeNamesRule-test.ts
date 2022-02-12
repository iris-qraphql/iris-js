import type { IrisSchema } from '../../types/schema';
import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { UniqueNamesRule } from '../rules/UniqueNamesRule';

function expectSDLErrors(sdlStr: string, schema?: IrisSchema) {
  return expect(getSDLValidationErrors(schema, UniqueNamesRule, sdlStr));
}

const expectValidSDL = (sdlStr: string, schema?: IrisSchema) =>
  expectSDLErrors(sdlStr, schema).toEqual([]);

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
    `).toMatchSnapshot();
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
    `).toMatchSnapshot();
  });
});

describe('Validate: Unique variant definition names', () => {
  it('multiple variants', () => {
    expectValidSDL(`
      data SomData = A {} | B {}
      resolver SomeResolver = A {} | B {}
    `);
  });

  it('duplicate fields inside the same type definition', () => {
    expectSDLErrors(`
      data SomData 
        = A {} 
        | B {}
        | A {}

      resolver SomeResolver 
        = C {} 
        | D {}
        | D {}
    `).toMatchSnapshot();
  });
});

describe('Validate: Unique argument definition names', () => {
  it('no args', () => {
    expectValidSDL(`
      resolver SomeObject = {
        someField: String
      }

      directive @someDirective on QUERY
    `);
  });

  it('one argument', () => {
    expectValidSDL(`
      resolver SomeObject = { someField(foo: String): String }
      directive @someDirective(foo: String) on QUERY
    `);
  });

  it('multiple arguments', () => {
    expectValidSDL(`
      resolver SomeObject = {
        someField(
          foo: String
          bar: String
        ): String
      }

      directive @someDirective(
        foo: String
        bar: String
      ) on QUERY
    `);
  });

  it('duplicating arguments', () => {
    expectSDLErrors(`
      resolver SomeObject = {
        someField(
          foo: String
          bar: String
          foo: String
        ): String
      }

      directive @someDirective(
        foo: String
        bar: String
        foo: String
      ) on QUERY
    `).toMatchSnapshot();
  });
});
