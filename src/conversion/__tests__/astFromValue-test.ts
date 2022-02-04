import {
  gqlInput,
  gqlList,
  gqlScalar,
  maybe,
  sampleType,
} from '../../type/make';
import {
  IrisBool,
  IrisFloat,
  IrisID,
  IrisInt,
  IrisString,
} from '../../type/scalars';

import { toJSONError } from '../../utils/toJSONDeep';

import { astFromValue } from '../astFromValue';

const maybeBool = maybe(IrisBool);

describe('astFromValue', () => {
  it('converts boolean values to ASTs', () => {
    expect(astFromValue(true, maybeBool)).toEqual({
      kind: 'BooleanValue',
      value: true,
    });

    expect(astFromValue(false, maybeBool)).toEqual({
      kind: 'BooleanValue',
      value: false,
    });

    expect(astFromValue(undefined, maybeBool)).toEqual(null);

    expect(astFromValue(null, maybeBool)).toEqual({
      kind: 'NullValue',
    });

    expect(astFromValue(0, IrisBool)).toEqual({
      kind: 'BooleanValue',
      value: false,
    });

    expect(astFromValue(1, IrisBool)).toEqual({
      kind: 'BooleanValue',
      value: true,
    });

    const NonNullBoolean = IrisBool;
    expect(astFromValue(0, NonNullBoolean)).toEqual({
      kind: 'BooleanValue',
      value: false,
    });
  });

  it('converts Int values to Int ASTs', () => {
    expect(astFromValue(-1, IrisInt)).toEqual({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValue(123.0, IrisInt)).toEqual({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue(1e4, IrisInt)).toEqual({
      kind: 'IntValue',
      value: '10000',
    });

    // GraphQL spec does not allow coercing non-integer values to Int to avoid
    // accidental data loss.
    expect(() => astFromValue(123.5, IrisInt)).toThrow(
      'Int cannot represent non-integer value: 123.5',
    );

    // Note: outside the bounds of 32bit signed int.
    expect(() => astFromValue(1e40, IrisInt)).toThrow(
      'Int cannot represent non 32-bit signed integer value: 1e+40',
    );

    expect(() => astFromValue(NaN, IrisInt)).toThrow(
      'Int cannot represent non-integer value: NaN',
    );
  });

  it('converts Float values to Int/Float ASTs', () => {
    expect(astFromValue(-1, IrisFloat)).toEqual({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValue(123.0, IrisFloat)).toEqual({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue(123.5, IrisFloat)).toEqual({
      kind: 'FloatValue',
      value: '123.5',
    });

    expect(astFromValue(1e4, IrisFloat)).toEqual({
      kind: 'IntValue',
      value: '10000',
    });

    expect(astFromValue(1e40, IrisFloat)).toEqual({
      kind: 'FloatValue',
      value: '1e+40',
    });
  });

  it('converts String values to String ASTs', () => {
    expect(astFromValue('hello', IrisString)).toEqual({
      kind: 'StringValue',
      value: 'hello',
    });

    expect(astFromValue('VALUE', IrisString)).toEqual({
      kind: 'StringValue',
      value: 'VALUE',
    });

    expect(astFromValue('VA\nLUE', IrisString)).toEqual({
      kind: 'StringValue',
      value: 'VA\nLUE',
    });

    expect(astFromValue(123, IrisString)).toEqual({
      kind: 'StringValue',
      value: '123',
    });

    expect(astFromValue(false, IrisString)).toEqual({
      kind: 'StringValue',
      value: 'false',
    });

    expect(astFromValue(null, maybe(IrisString))).toEqual({
      kind: 'NullValue',
    });

    expect(astFromValue(undefined, IrisString)).toEqual(null);
  });

  it('converts ID values to Int/String ASTs', () => {
    expect(astFromValue('hello', IrisID)).toEqual({
      kind: 'StringValue',
      value: 'hello',
    });

    expect(astFromValue('VALUE', IrisID)).toEqual({
      kind: 'StringValue',
      value: 'VALUE',
    });

    // Note: EnumValues cannot contain non-identifier characters
    expect(astFromValue('VA\nLUE', IrisID)).toEqual({
      kind: 'StringValue',
      value: 'VA\nLUE',
    });

    // Note: IntValues are used when possible.
    expect(astFromValue(-1, IrisID)).toEqual({
      kind: 'IntValue',
      value: '-1',
    });

    expect(astFromValue(123, IrisID)).toEqual({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue('123', IrisID)).toEqual({
      kind: 'IntValue',
      value: '123',
    });

    expect(astFromValue('01', IrisID)).toEqual({
      kind: 'StringValue',
      value: '01',
    });

    expect(() => astFromValue(false, IrisID)).toThrow(
      'ID cannot represent value: false',
    );

    expect(astFromValue(null, maybe(IrisID))).toEqual({ kind: 'NullValue' });

    expect(astFromValue(undefined, IrisID)).toEqual(null);
  });

  it('converts using serialize from a custom scalar type', () => {
    const passthroughScalar = gqlScalar({
      name: 'PassthroughScalar',
      serialize(value) {
        return value;
      },
    });

    expect(astFromValue('value', passthroughScalar)).toEqual({
      kind: 'StringValue',
      value: 'value',
    });

    expect(() => astFromValue(NaN, passthroughScalar)).toThrow(
      'Cannot convert value to AST: NaN.',
    );
    expect(() => astFromValue(Infinity, passthroughScalar)).toThrow(
      'Cannot convert value to AST: Infinity.',
    );

    const returnNullScalar = gqlScalar({
      name: 'ReturnNullScalar',
      serialize() {
        return null;
      },
    });

    expect(astFromValue('value', returnNullScalar)).toEqual(null);

    class SomeClass {}

    const returnCustomClassScalar = gqlScalar({
      name: 'ReturnCustomClassScalar',
      serialize() {
        return new SomeClass();
      },
    });

    expect(() => astFromValue('value', returnCustomClassScalar)).toThrow(
      'Cannot convert value to AST: {}.',
    );
  });

  it('does not converts NonNull values to NullValue', () => {
    expect(astFromValue(null, IrisBool)).toEqual(null);
  });

  const myEnum = sampleType({
    role: 'data',
    name: 'MyEnum',
    body: ' HELLO{} | GOODBYE{}',
  });

  it('converts string values to Enum ASTs if possible', () => {
    expect(astFromValue('HELLO', myEnum)).toEqual({
      kind: 'EnumValue',
      value: 'HELLO',
    });

    // Note: case sensitive
    expect(() => astFromValue('hello', myEnum)).toThrow(
      'Data "MyEnum" cannot represent value: "hello"',
    );

    // Note: Not a valid enum value
    expect(() => astFromValue('UNKNOWN_VALUE', myEnum)).toThrow(
      'Data "MyEnum" cannot represent value: "UNKNOWN_VALUE"',
    );
  });

  it('converts array values to List ASTs', () => {
    expect(astFromValue(['FOO', 'BAR'], gqlList(IrisString))).toEqual({
      kind: 'ListValue',
      values: [
        { kind: 'StringValue', value: 'FOO' },
        { kind: 'StringValue', value: 'BAR' },
      ],
    });

    expect(astFromValue(['HELLO', 'GOODBYE'], gqlList(myEnum))).toEqual({
      kind: 'ListValue',
      values: [
        { kind: 'EnumValue', value: 'HELLO' },
        { kind: 'EnumValue', value: 'GOODBYE' },
      ],
    });

    function* listGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    expect(astFromValue(listGenerator(), gqlList(IrisInt))).toEqual({
      kind: 'ListValue',
      values: [
        { kind: 'IntValue', value: '1' },
        { kind: 'IntValue', value: '2' },
        { kind: 'IntValue', value: '3' },
      ],
    });
  });

  it('converts list singletons', () => {
    expect(astFromValue('FOO', gqlList(IrisString))).toEqual({
      kind: 'StringValue',
      value: 'FOO',
    });
  });

  it('skip invalid list items', () => {
    const ast = astFromValue(['FOO', null, 'BAR'], gqlList(IrisString));

    expect(ast).toEqual({
      kind: 'ListValue',
      values: [
        { kind: 'StringValue', value: 'FOO' },
        { kind: 'StringValue', value: 'BAR' },
      ],
    });
  });

  const inputObj = gqlInput({
    name: 'MyInputObj',
    fields: {
      foo: { type: maybe(IrisFloat) },
      bar: { type: maybe(myEnum) },
    },
  });

  it('converts input objects', () => {
    expect(astFromValue({ foo: 3, bar: 'HELLO' }, inputObj)).toEqual({
      kind: 'ObjectValue',
      fields: [
        {
          kind: 'ObjectField',
          name: { kind: 'Name', value: 'foo' },
          value: { kind: 'IntValue', value: '3' },
        },
        {
          kind: 'ObjectField',
          name: { kind: 'Name', value: 'bar' },
          value: { kind: 'EnumValue', value: 'HELLO' },
        },
      ],
    });
  });

  it('converts input objects with explicit nulls', () => {
    expect(astFromValue({ foo: null }, inputObj)).toEqual({
      kind: 'ObjectValue',
      fields: [
        {
          kind: 'ObjectField',
          name: { kind: 'Name', value: 'foo' },
          value: { kind: 'NullValue' },
        },
      ],
    });
  });

  it('does not converts non-object values as input objects', () => {
    expect(toJSONError(() => astFromValue(5, inputObj))).toEqual({
      message: 'Data "MyInputObj" cannot represent non-string value: 5.',
    });
  });
});
