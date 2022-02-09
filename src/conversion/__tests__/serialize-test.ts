import type { IrisType } from '../../type/definition';
import { assertDataType } from '../../type/definition';
import { gqlList, gqlScalar, maybe, sampleTypeRef } from '../../type/make';
import { IrisFloat, IrisID, IrisInt, IrisString } from '../../type/scalars';
import { buildSchema } from '../../type/schema';

import { serializeValue } from '../serialize';

const serializeWith = (value: unknown, typeRef: string | IrisType<'data'>) => {
  const type =
    typeof typeRef === 'string' ? sampleTypeRef<'data'>(typeRef) : typeRef;
  return serializeValue(value, type);
};

describe('serializeValue', () => {
  it('converts boolean values to ASTs', () => {
    expect(serializeWith(true, 'Boolean?')).toEqual(true);
    expect(serializeWith(false, 'Boolean?')).toEqual(false);
    expect(serializeWith(undefined, 'Boolean?')).toEqual(null);
    expect(serializeWith(null, 'Boolean?')).toEqual(null);
    expect(serializeWith(0, 'Boolean')).toEqual(false);
    expect(serializeWith(1, 'Boolean')).toEqual(true);
  });

  it('converts Int values to Int ASTs', () => {
    expect(serializeWith(-1, IrisInt)).toEqual(-1);
    expect(serializeWith(123.0, IrisInt)).toEqual(123);
    expect(serializeWith(1e4, IrisInt)).toEqual(10000);
    expect(() => serializeWith(123.5, IrisInt)).toThrow(
      'Int cannot represent non-integer value: 123.5',
    );

    expect(() => serializeWith(1e40, IrisInt)).toThrow(
      'Int cannot represent non 32-bit signed integer value: 1e+40',
    );

    expect(() => serializeWith(NaN, IrisInt)).toThrow(
      'Int cannot represent non-integer value: NaN',
    );
  });

  it('converts Float values to Int/Float ASTs', () => {
    expect(serializeWith(-1, IrisFloat)).toEqual(-1);

    expect(serializeWith(123.0, IrisFloat)).toEqual(123);

    expect(serializeWith(123.5, IrisFloat)).toEqual(123.5);

    expect(serializeWith(1e4, IrisFloat)).toEqual(10000);

    expect(serializeWith(1e40, IrisFloat)).toEqual(1e40);
  });

  it('converts String values to String ASTs', () => {
    expect(serializeWith('hello', IrisString)).toEqual('hello');

    expect(serializeWith('VALUE', IrisString)).toEqual('VALUE');

    expect(serializeWith('VA\nLUE', IrisString)).toEqual('VA\nLUE');

    expect(serializeWith(123, IrisString)).toEqual('123');

    expect(serializeWith(false, IrisString)).toEqual('false');

    // optional
    expect(serializeWith(null, maybe(IrisString))).toEqual(null);
    expect(serializeWith(undefined, maybe(IrisString))).toEqual(null);

    // required
    expect(() =>
      serializeWith(undefined, IrisString),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeWith(null, IrisString),
    ).toThrowErrorMatchingSnapshot();
  });

  it('converts ID values to Int/String ASTs', () => {
    expect(serializeWith('hello', IrisID)).toEqual('hello');

    expect(serializeWith('VALUE', IrisID)).toEqual('VALUE');

    expect(serializeWith('VA\nLUE', IrisID)).toEqual('VA\nLUE');

    expect(serializeWith(-1, IrisID)).toEqual('-1');

    expect(serializeWith(123, IrisID)).toEqual('123');

    expect(serializeWith('123', IrisID)).toEqual('123');

    expect(serializeWith('01', IrisID)).toEqual('01');

    // nullable
    expect(serializeWith(null, maybe(IrisID))).toEqual(null);
    expect(serializeWith(undefined, maybe(IrisID))).toEqual(null);

    // required
    expect(() => serializeWith(false, IrisID)).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeWith(undefined, IrisID),
    ).toThrowErrorMatchingSnapshot();
    expect(() => serializeWith(null, IrisID)).toThrowErrorMatchingSnapshot();
  });

  it('converts using serialize from a custom scalar type', () => {
    const passthroughScalar = gqlScalar({
      name: 'PassthroughScalar',
      serialize(value) {
        return value;
      },
    });

    expect(serializeWith('value', passthroughScalar)).toEqual('value');

    expect(() =>
      serializeWith(NaN, passthroughScalar),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeWith(Infinity, passthroughScalar),
    ).toThrowErrorMatchingSnapshot();

    const returnNullScalar = gqlScalar({
      name: 'ReturnNullScalar',
      serialize() {
        return null;
      },
    });

    expect(serializeWith('value', returnNullScalar)).toEqual(null);
  });

  it('does not converts NonNull values to NullValue', () => {
    expect(() => serializeWith(null, 'Boolean')).toThrowErrorMatchingSnapshot();
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
    expect(serializeWith('HELLO', myEnum)).toEqual('HELLO');

    // Note: case sensitive
    expect(() => serializeWith('hello', myEnum)).toThrow(
      'Data "MyEnum" cannot represent value: "hello"',
    );

    // Note: Not a valid enum value
    expect(() => serializeWith('UNKNOWN_VALUE', myEnum)).toThrow(
      'Data "MyEnum" cannot represent value: "UNKNOWN_VALUE"',
    );
  });

  it('converts array values to List ASTs', () => {
    expect(serializeWith(['FOO', 'BAR'], sampleTypeRef('[String]'))).toEqual([
      'FOO',
      'BAR',
    ]);

    expect(serializeWith(['HELLO', 'GOODBYE'], gqlList(myEnum))).toEqual([
      'HELLO',
      'GOODBYE',
    ]);

    function* listGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    expect(serializeWith(listGenerator(), sampleTypeRef('[Int]'))).toEqual([
      1, 2, 3,
    ]);
  });

  it('reject invalid lists', () => {
    expect(() =>
      serializeWith(['FOO', null], sampleTypeRef('[String]')),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeWith('FOO', sampleTypeRef('[String]')),
    ).toThrowErrorMatchingSnapshot();
  });

  it('converts data objects', () => {
    const object = { foo: 3, bar: 'HELLO' };
    expect(serializeWith(object, inputObj)).toEqual(object);
  });

  it('converts input objects with explicit nulls', () => {
    expect(serializeWith({ foo: null }, inputObj)).toEqual({
      foo: null,
      bar: null,
    });
  });

  it('does not converts non-object values as input objects', () => {
    expect(() => serializeWith(5, inputObj)).toThrowErrorMatchingSnapshot();
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
  const parseNode = (n: unknown) => serializeWith(n, nodeType);

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
  const parseNode = (n: unknown) => serializeWith(n, nodeType);

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
