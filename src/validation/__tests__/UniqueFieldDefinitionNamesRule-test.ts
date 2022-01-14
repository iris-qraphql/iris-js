import type { GraphQLSchema } from '../../type/schema';

import { expectSDLValidationErrors } from '../__mocha__/harness';
import { UniqueVariantAndFieldDefinitionNamesRule } from '../rules/UniqueVariantAndFieldDefinitionNamesRule';

function expectSDLErrors(sdlStr: string, schema?: GraphQLSchema) {
  return expectSDLValidationErrors(
    schema,
    UniqueVariantAndFieldDefinitionNamesRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr: string, schema?: GraphQLSchema) {
  expectSDLErrors(sdlStr, schema).toDeepEqual([]);
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

      data SomeInputObject {
        foo: String
        bar: String
        foo: String
      }
    `).toDeepEqual([
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
      }
    ]);
  });


});
