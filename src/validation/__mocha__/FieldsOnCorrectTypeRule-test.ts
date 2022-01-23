import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import type { GraphQLSchema } from '../../type/schema';

import { buildSchema } from '../../utilities/buildASTSchema';

import { FieldsOnCorrectTypeRule } from '../rules/FieldsOnCorrectTypeRule';
import { validate } from '../validate';

import { expectValidationErrorsWithSchema } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    testSchema,
    FieldsOnCorrectTypeRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

const testSchema = buildSchema(`
  resolver Dog = {
    name: String
    nickname: String
    barkVolume: Int
  }

  resolver Cat = {
    name: String
    nickname: String
    meowVolume: Int
  }

  resolver Pet = Cat | Dog

  resolver Human = {
    name: String
    pets: [Pet]
  }

  resolver Query = {
    human: Human
  }
`);

describe('Validate: Fields on correct type', () => {
  it('Object field selection', () => {
    expectValid(`
      fragment objectFieldSelection on Dog {
        __typename
        name
      }
    `);
  });

  it('Aliased object field selection', () => {
    expectValid(`
      fragment aliasedObjectFieldSelection on Dog {
        tn : __typename
        otherName : name
      }
    `);
  });

  it('Lying alias selection', () => {
    expectValid(`
      fragment lyingAliasSelection on Dog {
        name : nickname
      }
    `);
  });

  it('Ignores fields on unknown type', () => {
    expectValid(`
      fragment unknownSelection on UnknownType {
        unknownField
      }
    `);
  });

  it('reports errors when type is known again', () => {
    expectErrors(`
      fragment typeKnownAgain on Pet {
        unknown_pet_field {
          ... on Cat {
            unknown_cat_field
          }
        }
      }
    `).toDeepEqual([
      {
        message: 'Cannot query field "unknown_pet_field" on type "Pet".',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message: 'Cannot query field "unknown_cat_field" on type "Cat".',
        locations: [{ line: 5, column: 13 }],
      },
    ]);
  });

  it('Field not defined on fragment', () => {
    expectErrors(`
      fragment fieldNotDefined on Dog {
        meowVolume
      }
    `).toDeepEqual([
      {
        message:
          'Cannot query field "meowVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Ignores deeply unknown field', () => {
    expectErrors(`
      fragment deepFieldNotDefined on Dog {
        unknown_field {
          deeper_unknown_field
        }
      }
    `).toDeepEqual([
      {
        message: 'Cannot query field "unknown_field" on type "Dog".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Sub-field not defined', () => {
    expectErrors(`
      fragment subFieldNotDefined on Human {
        pets {
          unknown_field
        }
      }
    `).toDeepEqual([
      {
        message: 'Cannot query field "unknown_field" on type "Pet".',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('Field not defined on inline fragment', () => {
    expectErrors(`
      fragment fieldNotDefined on Pet {
        ... on Dog {
          meowVolume
        }
      }
    `).toDeepEqual([
      {
        message:
          'Cannot query field "meowVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('Aliased field target not defined', () => {
    expectErrors(`
      fragment aliasedFieldTargetNotDefined on Dog {
        volume : mooVolume
      }
    `).toDeepEqual([
      {
        message:
          'Cannot query field "mooVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Aliased lying field target not defined', () => {
    expectErrors(`
      fragment aliasedLyingFieldTargetNotDefined on Dog {
        barkVolume : kawVolume
      }
    `).toDeepEqual([
      {
        message:
          'Cannot query field "kawVolume" on type "Dog". Did you mean "barkVolume"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Not defined on interface', () => {
    expectErrors(`
      fragment notDefinedOnInterface on Pet {
        tailLength
      }
    `).toDeepEqual([
      {
        message: 'Cannot query field "tailLength" on type "Pet".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('Meta field selection on unions', () => {
    expectValid(`
      fragment directFieldSelectionOnUnion on Pat {
        __typename
      }
    `);
  });

  describe('Fields on correct type error message', () => {
    function expectErrorMessage(schema: GraphQLSchema, queryStr: string) {
      const errors = validate(schema, parse(queryStr), [
        FieldsOnCorrectTypeRule,
      ]);
      expect(errors.length).to.equal(1);
      return expect(errors[0].message);
    }

    it('Works with no suggestions', () => {
      const schema = buildSchema(`
        resolver T = {
          fieldWithVeryLongNameThatWillNeverBeSuggested: String
        }
        resolver Query = { t: T }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T".',
      );
    });

    it('Works with no small numbers of type suggestions', () => {
      const schema = buildSchema(`
        resolver T = A | B
        resolver Query = { t: T }

        resolver A ={ f: String }
        resolver B = { f: String }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A" or "B"?',
      );
    });

    it('Works with no small numbers of field suggestions', () => {
      const schema = buildSchema(`
        resolver T = {
          y: String
          z: String
        }
        resolver Query = { t: T }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean "y" or "z"?',
      );
    });

    it('Limits lots of type suggestions', () => {
      const schema = buildSchema(`
        resolver T = A | B | C | D | E | F
        resolver Query = { t: T }

        resolver A = { f: String }
        resolver B = { f: String }
        resolver C = { f: String }
        resolver D = { f: String }
        resolver E = { f: String }
        resolver F = { f: String }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean to use an inline fragment on "A", "B", "C", "D", or "E"?',
      );
    });

    it('Limits lots of field suggestions', () => {
      const schema = buildSchema(`
        resolver T = {
          u: String
          v: String
          w: String
          x: String
          y: String
          z: String
        }
        resolver Query = { t: T }
      `);

      expectErrorMessage(schema, '{ t { f } }').to.equal(
        'Cannot query field "f" on type "T". Did you mean "u", "v", "w", "x", or "y"?',
      );
    });
  });
});
