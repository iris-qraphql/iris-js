import type { IrisSchema } from '../../type/schema';

import { getSDLValidationErrors } from '../../utils/harness';

import { UniqueVariantAndFieldDefinitionNamesRule } from '../rules/UniqueVariantAndFieldDefinitionNamesRule';

function expectSDLErrors(sdlStr: string, schema?: IrisSchema) {
  return expect(
    getSDLValidationErrors(
      schema,
      UniqueVariantAndFieldDefinitionNamesRule,
      sdlStr,
    ),
  );
}

function expectValidSDL(sdlStr: string, schema?: IrisSchema) {
  expectSDLErrors(sdlStr, schema).toEqual([]);
}

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
