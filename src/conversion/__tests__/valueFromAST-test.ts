import { identity } from 'ramda';

import { parseValue } from '../../language/parser';

import type { IrisType } from '../../types/definition';
import { gqlScalar, sampleTypeRef } from '../../utils/generators';
import type { ObjMap } from '../../utils/ObjMap';

import { valueFromAST } from '../valueFromAST';

const maybeListOfMaybeBool = sampleTypeRef<'data'>('[Boolean?]?');
const ListOfMaybeBool = sampleTypeRef<'data'>('[Boolean?]');
const listOfBool = sampleTypeRef<'data'>('[Boolean]');
const maybeListOfBool = sampleTypeRef<'data'>('[Boolean]?');

const expectValueFrom = (
  valueText: string,
  typeRef: IrisType<'data'> | string,
  variables?: ObjMap<unknown>,
) => {
  const type =
    typeof typeRef === 'string' ? sampleTypeRef<'data'>(typeRef) : typeRef;
  const ast = parseValue(valueText);
  const value = valueFromAST(ast, type, variables);
  return expect(value);
};

describe('valueFromAST', () => {
  it('rejects empty input', () => {
    expect(valueFromAST(null, sampleTypeRef('Boolean?'))).toEqual(undefined);
  });

  it('converts according to input coercion rules', () => {
    expectValueFrom('true', 'Boolean?').toEqual(true);
    expectValueFrom('false', 'Boolean?').toEqual(false);
    expectValueFrom('123', 'Int').toEqual(123);
    expectValueFrom('123', 'Float').toEqual(123);
    expectValueFrom('123.456', 'Float').toEqual(123.456);
    expectValueFrom('"abc123"', 'String').toEqual('abc123');
    expectValueFrom('123456', 'ID').toEqual('123456');
    expectValueFrom('"123456"', 'ID').toEqual('123456');
  });

  it('does not convert when input coercion rules reject a value', () => {
    expectValueFrom('123', 'Boolean?').toEqual(undefined);
    expectValueFrom('123.456', 'Int').toEqual(undefined);
    expectValueFrom('true', 'Int').toEqual(undefined);
    expectValueFrom('"123"', 'Int').toEqual(undefined);
    expectValueFrom('"123"', 'Float').toEqual(undefined);
    expectValueFrom('123', 'String').toEqual(undefined);
    expectValueFrom('true', 'String').toEqual(undefined);
    expectValueFrom('123.456', 'String').toEqual(undefined);
  });

  it('convert using parseLiteral from a custom scalar type', () => {
    const passthroughScalar = gqlScalar({
      name: 'PassthroughScalar',
      parseLiteral(node) {
        if (node.kind === 'StringValue') {
          return node.value;
        }
      },
      parseValue: identity,
    });

    expectValueFrom('"value"', passthroughScalar).toEqual('value');

    const throwScalar = gqlScalar({
      name: 'ThrowScalar',
      parseLiteral() {
        throw new Error('Test');
      },
      parseValue: identity,
    });

    expectValueFrom('value', throwScalar).toEqual(undefined);

    const returnUndefinedScalar = gqlScalar({
      name: 'ReturnUndefinedScalar',
      parseLiteral() {
        return undefined;
      },
      parseValue: identity,
    });

    expectValueFrom('value', returnUndefinedScalar).toEqual(undefined);
  });

  it('coerces to null unless non-null', () => {
    expectValueFrom('null', 'Boolean?').toEqual(null);
    expectValueFrom('null', 'Boolean').toEqual(undefined);
  });

  it('coerces lists of values', () => {
    expectValueFrom('true', maybeListOfMaybeBool).toEqual([true]);
    expectValueFrom('123', maybeListOfMaybeBool).toEqual(undefined);
    expectValueFrom('null', maybeListOfMaybeBool).toEqual(null);
    expectValueFrom('[true, false]', maybeListOfMaybeBool).toEqual([
      true,
      false,
    ]);
    expectValueFrom('[true, 123]', maybeListOfMaybeBool).toEqual(undefined);
    expectValueFrom('[true, null]', maybeListOfMaybeBool).toEqual([true, null]);
    expectValueFrom('{ true: true }', maybeListOfMaybeBool).toEqual(undefined);
  });

  it('coerces non-null lists of values', () => {
    expectValueFrom('true', ListOfMaybeBool).toEqual([true]);
    expectValueFrom('123', ListOfMaybeBool).toEqual(undefined);
    expectValueFrom('null', ListOfMaybeBool).toEqual(undefined);
    expectValueFrom('[true, false]', ListOfMaybeBool).toEqual([true, false]);
    expectValueFrom('[true, 123]', ListOfMaybeBool).toEqual(undefined);
    expectValueFrom('[true, null]', ListOfMaybeBool).toEqual([true, null]);
  });

  it('coerces lists of non-null values', () => {
    expectValueFrom('true', maybeListOfBool).toEqual([true]);
    expectValueFrom('123', maybeListOfBool).toEqual(undefined);
    expectValueFrom('null', maybeListOfBool).toEqual(null);
    expectValueFrom('[true, false]', maybeListOfBool).toEqual([true, false]);
    expectValueFrom('[true, 123]', maybeListOfBool).toEqual(undefined);
    expectValueFrom('[true, null]', maybeListOfBool).toEqual(undefined);
  });

  it('coerces non-null lists of non-null values', () => {
    expectValueFrom('true', listOfBool).toEqual([true]);
    expectValueFrom('123', listOfBool).toEqual(undefined);
    expectValueFrom('null', listOfBool).toEqual(undefined);
    expectValueFrom('[true, false]', listOfBool).toEqual([true, false]);
    expectValueFrom('[true, 123]', listOfBool).toEqual(undefined);
    expectValueFrom('[true, null]', listOfBool).toEqual(undefined);
  });

  const sampleInput = (ref: string) =>
    sampleTypeRef<'data'>(
      ref,
      `
      data TestInput = { 
        int: Int?
        bool: Boolean?
        requiredBool: Boolean
      }
    `,
    );

  const testInputObj = sampleInput('TestInput');

  it('coerces input objects according to input coercion rules', () => {
    expectValueFrom('null', sampleInput('TestInput?')).toEqual(null);
    expectValueFrom('123', testInputObj).toEqual(undefined);
    expectValueFrom('[]', testInputObj).toEqual(undefined);
    expectValueFrom('{ int: 123, requiredBool: false }', testInputObj).toEqual({
      int: 123,
      requiredBool: false,
    });
    expectValueFrom(
      '{ bool: true, requiredBool: false }',
      testInputObj,
    ).toEqual({
      bool: true,
      requiredBool: false,
    });
    expectValueFrom('{ int: true, requiredBool: true }', testInputObj).toEqual(
      undefined,
    );
    expectValueFrom('{ requiredBool: null }', testInputObj).toEqual(undefined);
    expectValueFrom('{ bool: true }', testInputObj).toEqual(undefined);
  });

  it('accepts variable values assuming already coerced', () => {
    expectValueFrom('$var', 'Boolean?', {}).toEqual(undefined);
    expectValueFrom('$var', 'Boolean?', { var: true }).toEqual(true);
    expectValueFrom('$var', 'Boolean?', { var: null }).toEqual(null);
    expectValueFrom('$var', 'Boolean', { var: null }).toEqual(undefined);
  });

  it('asserts variables are provided as items in lists', () => {
    expectValueFrom('[ $foo ]', maybeListOfMaybeBool, {}).toEqual([null]);
    expectValueFrom('[ $foo ]', maybeListOfBool, {}).toEqual(undefined);
    expectValueFrom('[ $foo ]', maybeListOfBool, {
      foo: true,
    }).toEqual([true]);
    // Note: variables are expected to have already been coerced, so we
    // do not expect the singleton wrapping behavior for variables.
    expectValueFrom('$foo', maybeListOfBool, { foo: true }).toEqual(true);
    expectValueFrom('$foo', maybeListOfBool, { foo: [true] }).toEqual([true]);
  });

  it('omits input object fields for unprovided variables', () => {
    expectValueFrom(
      '{ int: $foo, bool: $foo, requiredBool: true }',
      testInputObj,
      {},
    ).toEqual({ requiredBool: true });

    expectValueFrom('{ requiredBool: $foo }', testInputObj, {}).toEqual(
      undefined,
    );

    expectValueFrom('{ requiredBool: $foo }', testInputObj, {
      foo: true,
    }).toEqual({
      requiredBool: true,
    });
  });
});
