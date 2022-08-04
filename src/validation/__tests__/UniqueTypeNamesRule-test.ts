import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { UniqueNamesRule } from '../rules/UniqueNamesRule';

function expectSDLErrors(sdlStr: string) {
  return expect(getSDLValidationErrors(UniqueNamesRule, sdlStr));
}

const expectValidSDL = (sdlStr: string) => expectSDLErrors(sdlStr).toEqual([]);

describe('Validate: Unique type names', () => {
  it('one type', () => {
    expectValidSDL(`
      data Foo
    `);
  });

  it('many types', () => {
    expectValidSDL(`
      data Foo
      data Bar
      data Baz
    `);
  });

  it('types named the same', () => {
    expectSDLErrors(`
      data Foo
      data Foo
      data Foo
    `).toMatchSnapshot();
  });
});

describe('Validate: Unique field definition names', () => {
  it('no fields', () => {
    expectValidSDL(`
      data SomeObject
      data SomeInputObject
    `);
  });

  it('one field', () => {
    expectValidSDL(`
      data SomeObject = {
        foo: String
      }

      data SomeInputObject = {
        foo: String
      }
    `);
  });

  it('multiple fields', () => {
    expectValidSDL(`
      data SomeObject = {
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
      data SomeObject = {
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
      data Somedata = A {} | B {}
    `);
  });

  it('duplicate fields inside the same type definition', () => {
    expectSDLErrors(`
      data SomData 
        = A {} 
        | B {}
        | A {}

      data Somedata 
        = C {} 
        | D {}
        | D {}
    `).toMatchSnapshot();
  });
});
