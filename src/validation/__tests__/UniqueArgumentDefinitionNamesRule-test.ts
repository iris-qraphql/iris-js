import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { UniqueArgumentDefinitionNamesRule } from '../rules/UniqueArgumentDefinitionNamesRule';

function expectSDLErrors(sdlStr: string) {
  return expect(
    getSDLValidationErrors(
      undefined,
      UniqueArgumentDefinitionNamesRule,
      sdlStr,
    ),
  );
}

function expectValidSDL(sdlStr: string) {
  expectSDLErrors(sdlStr).toEqual([]);
}

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
      resolver SomeObject = {
        someField(foo: String): String
      }
  
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
    `).toEqual([
      {
        message:
          'Argument "SomeObject.someField(foo:)" can only be defined once.',
        locations: [
          { line: 4, column: 11 },
          { line: 6, column: 11 },
        ],
      },
      {
        message: 'Argument "@someDirective(foo:)" can only be defined once.',
        locations: [
          { line: 11, column: 9 },
          { line: 13, column: 9 },
        ],
      },
    ]);
  });
});
