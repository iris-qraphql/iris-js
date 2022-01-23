import { describe, it } from 'mocha';

import type { GraphQLSchema } from '../../type/schema';

import { UniqueVariantAndFieldDefinitionNamesRule } from '../rules/UniqueVariantAndFieldDefinitionNamesRule';

import { expectSDLValidationErrors } from './harness';

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

describe('Validate: Unique variant value names', () => {
  it('no values', () => {
    expectValidSDL(`
      data SomeEnum
    `);
  });

  it('one value', () => {
    expectValidSDL(`
      data SomeEnum = FOO
    `);
  });

  it('multiple values', () => {
    expectValidSDL(`
      data SomeEnum 
        = FOO 
        | BAR
    `);
  });

  it('duplicate values inside the same datatype Definition', () => {
    expectSDLErrors(`
      data SomeEnum 
        = FOO 
        | BAR 
        | FOO
    `).toDeepEqual([
      {
        message: 'Variant "SomeEnum.FOO" can only be defined once.',
        locations: [
          { line: 3, column: 11 },
          { line: 5, column: 11 },
        ],
      },
    ]);
  });
});

describe('Validate: Unique Resolver variants', () => {
  it('rejects a Union type with duplicated member type', () => {
    expectSDLErrors(`
      resolver Query = {
        test: BadUnion
      }
  
      resolver TypeA = {
        field: String
      }
  
      resolver TypeB = {
        field: String
      }
  
      resolver BadUnion 
        = TypeA
        | TypeB
        | TypeA
    `).toDeepEqual([
      {
        message: 'Variant "BadUnion.TypeA" can only be defined once.',
        locations: [
          { line: 15, column: 11 },
          { line: 17, column: 11 },
        ],
      },
    ]);
  });
});
