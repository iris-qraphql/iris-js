import type { GraphQLInputType } from '../../type/definition';
import { GraphQLList, GraphQLNonNull } from '../../type/definition';
import { gqlEnum, gqlInput, gqlScalar } from '../../type/make';
import { GraphQLInt } from '../../type/scalars';

import { coerceInputValue } from '../coerceInputValue';

type CoerceResult = {
  value: unknown;
  errors: ReadonlyArray<CoerceError>;
};

type CoerceError = {
  path: ReadonlyArray<string | number>;
  value: unknown;
  error: string;
};

function coerceValue(
  inputValue: unknown,
  type: GraphQLInputType,
): CoerceResult {
  const errors: Array<CoerceError> = [];
  const value = coerceInputValue(
    inputValue,
    type,
    (path, invalidValue, error) => {
      errors.push({ path, value: invalidValue, error: error.message });
    },
  );

  return { errors, value };
}

function expectValue(result: CoerceResult) {
  expect(result.errors).toEqual([]);
  return expect(result.value);
}

function expectErrors(result: CoerceResult) {
  return expect(result.errors);
}

describe('coerceInputValue', () => {
  describe('for GraphQLNonNull', () => {
    const TestNonNull = new GraphQLNonNull(GraphQLInt);

    it('returns no error for non-null value', () => {
      const result = coerceValue(1, TestNonNull);
      expectValue(result).toEqual(1);
    });

    it('returns an error for undefined value', () => {
      const result = coerceValue(undefined, TestNonNull);
      expectErrors(result).toEqual([
        {
          error: 'Expected non-nullable type "Int!" not to be null.',
          path: [],
          value: undefined,
        },
      ]);
    });

    it('returns an error for null value', () => {
      const result = coerceValue(null, TestNonNull);
      expectErrors(result).toEqual([
        {
          error: 'Expected non-nullable type "Int!" not to be null.',
          path: [],
          value: null,
        },
      ]);
    });
  });

  describe('for GraphQLScalar', () => {
    const TestScalar = gqlScalar({
      name: 'TestScalar',
      parseValue(input: any) {
        if (input.error != null) {
          throw new Error(input.error);
        }
        return input.value;
      },
    });

    it('returns no error for valid input', () => {
      const result = coerceValue({ value: 1 }, TestScalar);
      expectValue(result).toEqual(1);
    });

    it('returns no error for null result', () => {
      const result = coerceValue({ value: null }, TestScalar);
      expectValue(result).toEqual(null);
    });

    it('returns no error for NaN result', () => {
      const result = coerceValue({ value: NaN }, TestScalar);
      expectValue(result).toBeNaN();
    });

    it('returns an error for undefined result', () => {
      const result = coerceValue({ value: undefined }, TestScalar);
      expectErrors(result).toEqual([
        {
          error: 'Expected type "TestScalar".',
          path: [],
          value: { value: undefined },
        },
      ]);
    });

    it('returns an error for undefined result', () => {
      const inputValue = { error: 'Some error message' };
      const result = coerceValue(inputValue, TestScalar);
      expectErrors(result).toEqual([
        {
          error: 'Expected type "TestScalar". Some error message',
          path: [],
          value: { error: 'Some error message' },
        },
      ]);
    });
  });

  describe('GraphQLEnum', () => {
    const TestEnum = gqlEnum('TestEnum', ['FOO', 'BAR']);

    it('returns no error for a known Enum name', () => {
      expectValue(coerceValue('FOO', TestEnum)).toEqual('FOO');
    });

    it('returns an error for misspelled Enum value', () => {
      const result = coerceValue('foo', TestEnum);
      expectErrors(result).toEqual([
        {
          error:
            'Value "foo" does not exist in "TestEnum" enum. Did you mean the enum value "FOO"?',
          path: [],
          value: 'foo',
        },
      ]);
    });

    it('returns an error for incorrect value type', () => {
      const result1 = coerceValue(123, TestEnum);
      expectErrors(result1).toEqual([
        {
          error: 'Enum "TestEnum" cannot represent non-string value: 123.',
          path: [],
          value: 123,
        },
      ]);

      const result2 = coerceValue({ field: 'value' }, TestEnum);
      expectErrors(result2).toEqual([
        {
          error:
            'Enum "TestEnum" cannot represent non-string value: { field: "value" }.',
          path: [],
          value: { field: 'value' },
        },
      ]);
    });
  });

  describe('for GraphQLInputObject', () => {
    const TestInputObject = gqlInput({
      name: 'TestInputObject',
      fields: {
        foo: { type: new GraphQLNonNull(GraphQLInt) },
        bar: { type: GraphQLInt },
      },
    });

    it('returns no error for a valid input', () => {
      const result = coerceValue({ foo: 123 }, TestInputObject);
      expectValue(result).toEqual({ foo: 123 });
    });

    it('returns an error for a non-object type', () => {
      const result = coerceValue(123, TestInputObject);
      expectErrors(result).toEqual([
        {
          error: 'Expected type "TestInputObject" to be an object.',
          path: [],
          value: 123,
        },
      ]);
    });

    it('returns an error for an invalid field', () => {
      const result = coerceValue({ foo: NaN }, TestInputObject);
      expectErrors(result).toEqual([
        {
          error: 'Int cannot represent non-integer value: NaN',
          path: ['foo'],
          value: NaN,
        },
      ]);
    });

    it('returns multiple errors for multiple invalid fields', () => {
      const result = coerceValue({ foo: 'abc', bar: 'def' }, TestInputObject);
      expectErrors(result).toEqual([
        {
          error: 'Int cannot represent non-integer value: "abc"',
          path: ['foo'],
          value: 'abc',
        },
        {
          error: 'Int cannot represent non-integer value: "def"',
          path: ['bar'],
          value: 'def',
        },
      ]);
    });

    it('returns error for a missing required field', () => {
      const result = coerceValue({ bar: 123 }, TestInputObject);
      expectErrors(result).toEqual([
        {
          error: 'Field "foo" of required type "Int!" was not provided.',
          path: [],
          value: { bar: 123 },
        },
      ]);
    });

    it('returns error for an unknown field', () => {
      const result = coerceValue(
        { foo: 123, unknownField: 123 },
        TestInputObject,
      );
      expectErrors(result).toEqual([
        {
          error:
            'Field "unknownField" is not defined by type "TestInputObject".',
          path: [],
          value: { foo: 123, unknownField: 123 },
        },
      ]);
    });

    it('returns error for a misspelled field', () => {
      const result = coerceValue({ foo: 123, bart: 123 }, TestInputObject);
      expectErrors(result).toEqual([
        {
          error:
            'Field "bart" is not defined by type "TestInputObject". Did you mean "bar"?',
          path: [],
          value: { foo: 123, bart: 123 },
        },
      ]);
    });
  });

  describe('for GraphQLList', () => {
    const TestList = new GraphQLList(GraphQLInt);

    it('returns no error for a valid input', () => {
      const result = coerceValue([1, 2, 3], TestList);
      expectValue(result).toEqual([1, 2, 3]);
    });

    it('returns no error for a valid iterable input', () => {
      function* listGenerator() {
        yield 1;
        yield 2;
        yield 3;
      }

      const result = coerceValue(listGenerator(), TestList);
      expectValue(result).toEqual([1, 2, 3]);
    });

    it('returns an error for an invalid input', () => {
      const result = coerceValue([1, 'b', true, 4], TestList);
      expectErrors(result).toEqual([
        {
          error: 'Int cannot represent non-integer value: "b"',
          path: [1],
          value: 'b',
        },
        {
          error: 'Int cannot represent non-integer value: true',
          path: [2],
          value: true,
        },
      ]);
    });

    it('returns a list for a non-list value', () => {
      const result = coerceValue(42, TestList);
      expectValue(result).toEqual([42]);
    });

    it('returns a list for a non-list object value', () => {
      const TestListOfObjects = new GraphQLList(
        gqlInput({
          name: 'TestObject',
          fields: {
            length: { type: GraphQLInt },
          },
        }),
      );

      const result = coerceValue({ length: 100500 }, TestListOfObjects);
      expectValue(result).toEqual([{ length: 100500 }]);
    });

    it('returns an error for a non-list invalid value', () => {
      const result = coerceValue('INVALID', TestList);
      expectErrors(result).toEqual([
        {
          error: 'Int cannot represent non-integer value: "INVALID"',
          path: [],
          value: 'INVALID',
        },
      ]);
    });

    it('returns null for a null value', () => {
      const result = coerceValue(null, TestList);
      expectValue(result).toEqual(null);
    });
  });

  describe('for nested GraphQLList', () => {
    const TestNestedList = new GraphQLList(new GraphQLList(GraphQLInt));

    it('returns no error for a valid input', () => {
      const result = coerceValue([[1], [2, 3]], TestNestedList);
      expectValue(result).toEqual([[1], [2, 3]]);
    });

    it('returns a list for a non-list value', () => {
      const result = coerceValue(42, TestNestedList);
      expectValue(result).toEqual([[42]]);
    });

    it('returns null for a null value', () => {
      const result = coerceValue(null, TestNestedList);
      expectValue(result).toEqual(null);
    });

    it('returns nested lists for nested non-list values', () => {
      const result = coerceValue([1, 2, 3], TestNestedList);
      expectValue(result).toEqual([[1], [2], [3]]);
    });

    it('returns nested null for nested null values', () => {
      const result = coerceValue([42, [null], null], TestNestedList);
      expectValue(result).toEqual([[42], [null], null]);
    });
  });

  describe('with default onError', () => {
    it('throw error without path', () => {
      expect(() =>
        coerceInputValue(null, new GraphQLNonNull(GraphQLInt)),
      ).toThrow(
        'Invalid value null: Expected non-nullable type "Int!" not to be null.',
      );
    });

    it('throw error with path', () => {
      expect(() =>
        coerceInputValue(
          [null],
          new GraphQLList(new GraphQLNonNull(GraphQLInt)),
        ),
      ).toThrow(
        'Invalid value null at "value[0]": Expected non-nullable type "Int!" not to be null.',
      );
    });
  });
});
