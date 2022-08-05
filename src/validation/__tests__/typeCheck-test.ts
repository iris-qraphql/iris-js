import { parseType } from '../../parsing/parser';
import type { IrisSchema } from '../../types/schema';
import { buildSchema } from '../../types/schema';

import { typeCheckValue } from '../typeCheckValue';

const serializeWith = (
  value: unknown,
  typeRef: string,
  schema: IrisSchema = buildSchema('data test = {}'),
) => typeCheckValue(schema, value, parseType(typeRef));

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
    expect(serializeWith(-1, 'Int')).toEqual(-1);
    expect(serializeWith(123.0, 'Int')).toEqual(123);
    expect(serializeWith(1e4, 'Int')).toEqual(10000);
    expect(() => serializeWith(123.5, 'Int')).toThrow(
      'Int cannot represent non-integer value: 123.5',
    );

    expect(() => serializeWith(1e40, 'Int')).toThrow(
      'Int cannot represent non 32-bit signed integer value: 1e+40',
    );

    expect(() => serializeWith(NaN, 'Int')).toThrow(
      'Int cannot represent non-integer value: NaN',
    );
  });

  it('converts Float values to Int/Float ASTs', () => {
    expect(serializeWith(-1, 'Float')).toEqual(-1);

    expect(serializeWith(123.0, 'Float')).toEqual(123);

    expect(serializeWith(123.5, 'Float')).toEqual(123.5);

    expect(serializeWith(1e4, 'Float')).toEqual(10000);

    expect(serializeWith(1e40, 'Float')).toEqual(1e40);
  });

  it('converts String values to String ASTs', () => {
    expect(serializeWith('hello', 'String')).toEqual('hello');

    expect(serializeWith('VALUE', 'String')).toEqual('VALUE');

    expect(serializeWith('VA\nLUE', 'String')).toEqual('VA\nLUE');

    expect(serializeWith(123, 'String')).toEqual('123');

    expect(serializeWith(false, 'String')).toEqual('false');

    // optional
    expect(serializeWith(null, 'String?')).toEqual(null);
    expect(serializeWith(undefined, 'String?')).toEqual(null);

    // required
    expect(() =>
      serializeWith(undefined, 'String'),
    ).toThrowErrorMatchingSnapshot();
    expect(() => serializeWith(null, 'String')).toThrowErrorMatchingSnapshot();
  });

  it('converts ID values to Int/String ASTs', () => {
    expect(serializeWith('hello', 'ID')).toEqual('hello');

    expect(serializeWith('VALUE', 'ID')).toEqual('VALUE');

    expect(serializeWith('VA\nLUE', 'ID')).toEqual('VA\nLUE');

    expect(serializeWith(-1, 'ID')).toEqual('-1');

    expect(serializeWith(123, 'ID')).toEqual('123');

    expect(serializeWith('123', 'ID')).toEqual('123');

    expect(serializeWith('01', 'ID')).toEqual('01');

    // nullable
    expect(serializeWith(null, 'ID?')).toEqual(null);
    expect(serializeWith(undefined, 'ID?')).toEqual(null);

    // required
    expect(() => serializeWith(false, 'ID')).toThrowErrorMatchingSnapshot();
    expect(() => serializeWith(undefined, 'ID')).toThrowErrorMatchingSnapshot();
    expect(() => serializeWith(null, 'ID')).toThrowErrorMatchingSnapshot();
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
  `);

  it('converts string values to Enum ASTs if possible', () => {
    expect(serializeWith('HELLO', 'MyEnum', schema)).toEqual('HELLO');

    expect(() =>
      serializeWith('hello', 'MyEnum', schema),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeWith('UNKNOWN_VALUE', 'MyEnum', schema),
    ).toThrowErrorMatchingSnapshot();
  });

  it('converts array values to List ASTs', () => {
    expect(serializeWith(['FOO', 'BAR'], '[String]', schema)).toEqual([
      'FOO',
      'BAR',
    ]);

    expect(serializeWith(['HELLO', 'GOODBYE'], '[MyEnum]', schema)).toEqual([
      'HELLO',
      'GOODBYE',
    ]);

    function* listGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    expect(serializeWith(listGenerator(), '[Int]', schema)).toEqual([1, 2, 3]);
  });

  it('reject invalid lists', () => {
    expect(() =>
      serializeWith(['FOO', null], '[String]', schema),
    ).toThrowErrorMatchingSnapshot();
    expect(() =>
      serializeWith('FOO', '[String]', schema),
    ).toThrowErrorMatchingSnapshot();
  });

  it('converts data objects', () => {
    const object = { foo: 3, bar: 'HELLO' };
    expect(serializeWith(object, 'MyInputObj', schema)).toEqual(object);
  });

  it('converts input objects with explicit nulls', () => {
    expect(serializeWith({ foo: null }, 'MyInputObj', schema)).toEqual({
      foo: null,
      bar: null,
    });
  });

  it('does not converts non-object values as input objects', () => {
    expect(() =>
      serializeWith(5, 'MyInputObj', schema),
    ).toThrowErrorMatchingSnapshot();
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

  const parseNode = (n: unknown) => serializeWith(n, 'NodeType', schema);

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

      data Query = {
        n: NodeType
      }
  `);

  const node = (...children: Array<unknown>) => ({
    __typename: 'Node',
    children,
  });
  const leaf = (name?: string) => ({ __typename: 'Leaf', name });

  const parseNode = (n: unknown) => serializeWith(n, 'NodeType', schema);

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
