import { assertDataType } from '../../type/definition';
import { gqlList, gqlScalar, maybe } from '../../type/make';
import {
  IrisBool,
  IrisFloat,
  IrisID,
  IrisInt,
  IrisString,
} from '../../type/scalars';
import { buildSchema } from '../../type/schema';

import { serializeValue } from '../serialize';

const maybeBool = maybe(IrisBool);

describe('serializeValue', () => {
  it('converts boolean values to ASTs', () => {
    expect(serializeValue(true, maybeBool)).toEqual(true);
    expect(serializeValue(false, maybeBool)).toEqual(false);
    expect(serializeValue(undefined, maybeBool)).toEqual(null);
    expect(serializeValue(null, maybeBool)).toEqual(null);
    expect(serializeValue(0, IrisBool)).toEqual(false);
    expect(serializeValue(1, IrisBool)).toEqual(true);
  });

  it('converts Int values to Int ASTs', () => {
    expect(serializeValue(-1, IrisInt)).toEqual(-1);
    expect(serializeValue(123.0, IrisInt)).toEqual(123);
    expect(serializeValue(1e4, IrisInt)).toEqual(10000);
    expect(() => serializeValue(123.5, IrisInt)).toThrow(
      'Int cannot represent non-integer value: 123.5',
    );

    expect(() => serializeValue(1e40, IrisInt)).toThrow(
      'Int cannot represent non 32-bit signed integer value: 1e+40',
    );

    expect(() => serializeValue(NaN, IrisInt)).toThrow(
      'Int cannot represent non-integer value: NaN',
    );
  });

  it('converts Float values to Int/Float ASTs', () => {
    expect(serializeValue(-1, IrisFloat)).toEqual(-1);

    expect(serializeValue(123.0, IrisFloat)).toEqual(123);

    expect(serializeValue(123.5, IrisFloat)).toEqual(123.5);

    expect(serializeValue(1e4, IrisFloat)).toEqual(10000);

    expect(serializeValue(1e40, IrisFloat)).toEqual(1e40);
  });

  it('converts String values to String ASTs', () => {
    expect(serializeValue('hello', IrisString)).toEqual('hello');

    expect(serializeValue('VALUE', IrisString)).toEqual('VALUE');

    expect(serializeValue('VA\nLUE', IrisString)).toEqual('VA\nLUE');

    expect(serializeValue(123, IrisString)).toEqual('123');

    expect(serializeValue(false, IrisString)).toEqual('false');

    // optional
    expect(serializeValue(null, maybe(IrisString))).toEqual(null);
    expect(serializeValue(undefined, maybe(IrisString))).toEqual(null);

    // required
    expect(() =>
      serializeValue(undefined, IrisString),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeValue(null, IrisString),
    ).toThrowErrorMatchingSnapshot();
  });

  it('converts ID values to Int/String ASTs', () => {
    expect(serializeValue('hello', IrisID)).toEqual('hello');

    expect(serializeValue('VALUE', IrisID)).toEqual('VALUE');

    expect(serializeValue('VA\nLUE', IrisID)).toEqual('VA\nLUE');

    expect(serializeValue(-1, IrisID)).toEqual('-1');

    expect(serializeValue(123, IrisID)).toEqual('123');

    expect(serializeValue('123', IrisID)).toEqual('123');

    expect(serializeValue('01', IrisID)).toEqual('01');

    // nullable
    expect(serializeValue(null, maybe(IrisID))).toEqual(null);
    expect(serializeValue(undefined, maybe(IrisID))).toEqual(null);

    // required
    expect(() => serializeValue(false, IrisID)).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeValue(undefined, IrisID),
    ).toThrowErrorMatchingSnapshot();
    expect(() => serializeValue(null, IrisID)).toThrowErrorMatchingSnapshot();
  });

  it('converts using serialize from a custom scalar type', () => {
    const passthroughScalar = gqlScalar({
      name: 'PassthroughScalar',
      serialize(value) {
        return value;
      },
    });

    expect(serializeValue('value', passthroughScalar)).toEqual('value');

    expect(() =>
      serializeValue(NaN, passthroughScalar),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeValue(Infinity, passthroughScalar),
    ).toThrowErrorMatchingSnapshot();

    const returnNullScalar = gqlScalar({
      name: 'ReturnNullScalar',
      serialize() {
        return null;
      },
    });

    expect(serializeValue('value', returnNullScalar)).toEqual(null);
  });

  it('does not converts NonNull values to NullValue', () => {
    expect(() => serializeValue(null, IrisBool)).toThrowErrorMatchingSnapshot();
  });

  const schema = buildSchema(`
    data MyEnum 
      = HELLO {} 
      | GOODBYE {}

    data MyInputObj = {
      foo: Float?
      bar: MyEnum?
    }

    resolver Query = {
      f: MyInputObj
    }
  `);

  const myEnum = assertDataType(schema.getType('MyEnum'));
  const inputObj = assertDataType(schema.getType('MyInputObj'));

  it('converts string values to Enum ASTs if possible', () => {
    expect(serializeValue('HELLO', myEnum)).toEqual('HELLO');

    // Note: case sensitive
    expect(() => serializeValue('hello', myEnum)).toThrow(
      'Data "MyEnum" cannot represent value: "hello"',
    );

    // Note: Not a valid enum value
    expect(() => serializeValue('UNKNOWN_VALUE', myEnum)).toThrow(
      'Data "MyEnum" cannot represent value: "UNKNOWN_VALUE"',
    );
  });

  it('converts array values to List ASTs', () => {
    expect(serializeValue(['FOO', 'BAR'], gqlList(IrisString))).toEqual([
      'FOO',
      'BAR',
    ]);

    expect(serializeValue(['HELLO', 'GOODBYE'], gqlList(myEnum))).toEqual([
      'HELLO',
      'GOODBYE',
    ]);

    function* listGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    expect(serializeValue(listGenerator(), gqlList(IrisInt))).toEqual([
      1, 2, 3,
    ]);
  });

  it('reject invalid lists', () => {
    expect(() =>
      serializeValue(['FOO', null], gqlList(IrisString)),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeValue('FOO', gqlList(IrisString)),
    ).toThrowErrorMatchingSnapshot();
  });

  it('converts data objects', () => {
    const object = { foo: 3, bar: 'HELLO' };
    expect(serializeValue(object, inputObj)).toEqual(object);
  });

  it('converts input objects with explicit nulls', () => {
    expect(serializeValue({ foo: null }, inputObj)).toEqual({
      foo: null,
      bar: null,
    });
  });

  it('does not converts non-object values as input objects', () => {
    expect(() => serializeValue(5, inputObj)).toThrowErrorMatchingSnapshot();
  });
});

describe('parse simple data variants', () => {
  const schema = buildSchema(`
      data NodeType 
        = Leaf { name: String} 
        | Node { children: [NodeType] }
  `);

  const node = (...children: Array<unknown>) => ({
    __typename: 'Node',
    children,
  });
  const leaf = (name: string) => ({ __typename: 'Leaf', name });

  const nodeType = assertDataType(schema.getType('NodeType'));
  const parseNode = (n: unknown) => serializeValue(n, nodeType);

  it("don't accept non data values", () => {
    expect(() => parseNode(['Leaf'])).toThrowErrorMatchingSnapshot();
    expect(() =>
      parseNode([{ __typename: 'Leaf', name: 'abcd' }]),
    ).toThrowErrorMatchingSnapshot();
  });

  it('require field names for non-empty variants', () => {
    expect(() => parseNode('Leaf')).toThrowErrorMatchingSnapshot();
    expect(() =>
      parseNode({ __typename: 'Leaf' }),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      parseNode({ __typename: 'Node' }),
    ).toThrowErrorMatchingSnapshot();
  });

  it('accept simple leaf', () => {
    expect(parseNode({ __typename: 'Leaf', name: 'abcd' })).toMatchSnapshot();
  });

  it('accept recursive nodes', () => {
    const tree1 = node(leaf('xyz'));
    const tree2 = node(leaf('abc'), tree1);
    const tree3 = node(tree1, tree2);
    const tree4 = node(tree1, node(tree2, tree3));
    const tree5 = node(node(tree1), node(tree2, tree3, tree4));

    expect(parseNode(tree1)).toMatchSnapshot();
    expect(parseNode(tree2)).toMatchSnapshot();
    expect(parseNode(tree3)).toMatchSnapshot();
    expect(parseNode(tree4)).toMatchSnapshot();
    expect(parseNode(tree5)).toMatchSnapshot();
  });

  it('reject invalid recursive nodes', () => {
    const tree1 = node(3);
    const tree2 = node([leaf('abc')], tree1);
    const tree3 = node(tree1, node(tree2));
    const tree4 = node(node(tree1), node(tree2, tree3));
    const tree5 = node(node(tree1), node(tree2, tree3), tree4);

    expect(() => parseNode(tree1)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree2)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree3)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree4)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree5)).toThrowErrorMatchingSnapshot();
  });
});

describe('circular data types', () => {
  const schema = buildSchema(`
      data Node = 
        { children: [NodeType] } 
    
      data NodeType 
        = Leaf { name: String? } 
        | Node

      resolver Query = {
        n: NodeType
      }
  `);

  const node = (...children: Array<unknown>) => ({
    __typename: 'Node',
    children,
  });
  const leaf = (name?: string) => ({ __typename: 'Leaf', name });

  const nodeType = assertDataType(schema.getType('NodeType'));
  const parseNode = (n: unknown) => serializeValue(n, nodeType);

  it('ignore optional fields variants', () => {
    expect(parseNode('Leaf')).toEqual('Leaf');
    expect(parseNode({ __typename: 'Leaf' })).toEqual('Leaf');
  });

  it('must provide required fields on variants', () => {
    expect(() =>
      parseNode({ __typename: 'Node' }),
    ).toThrowErrorMatchingSnapshot();
  });

  it('accept simple leaf', () => {
    expect(parseNode({ __typename: 'Leaf', name: 'abcd' })).toMatchSnapshot();
  });

  it('accept circular types', () => {
    const tree1 = node(leaf('xyz'));
    const tree2 = node(leaf('abc'), tree1);
    const tree3 = node(tree1, tree2);
    const tree4 = node(tree1, node(tree2, tree3));
    const tree5 = node(node(tree1), node(tree2, tree3, tree4));

    expect(parseNode(tree1)).toMatchSnapshot();
    expect(parseNode(tree2)).toMatchSnapshot();
    expect(parseNode(tree3)).toMatchSnapshot();
    expect(parseNode(tree4)).toMatchSnapshot();
    expect(parseNode(tree5)).toMatchSnapshot();
  });

  it('reject invalid circular types', () => {
    const tree1 = node(3);
    const tree2 = node([leaf('abc')], tree1);
    const tree3 = node(tree1, node(tree2));
    const tree4 = node(node(tree1), node(tree2, tree3));
    const tree5 = node(node(tree1), node(tree2, tree3), tree4);

    expect(() => parseNode(tree1)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree2)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree3)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree4)).toThrowErrorMatchingSnapshot();
    expect(() => parseNode(tree5)).toThrowErrorMatchingSnapshot();
  });
});
