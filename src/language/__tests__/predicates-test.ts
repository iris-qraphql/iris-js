import type { ASTNode } from '../ast';
import { Kind } from '../kinds';
import { parseValue } from '../parser';
import {
  isConstValueNode,
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isTypeDefinitionNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isValueNode,
} from '../predicates';

function filterNodes(predicate: (node: ASTNode) => boolean): Array<string> {
  return Object.values(Kind).filter(
    // @ts-expect-error create node only with kind
    (kind) => predicate({ kind }),
  );
}

describe('AST node predicates', () => {
  it('isDefinitionNode', () => {
    expect(filterNodes(isDefinitionNode)).toEqual([
      'OperationDefinition',
      'FragmentDefinition',
      'SchemaDefinition',
      'ResolverTypeDefinition',
      'DataTypeDefinition',
      'DirectiveDefinition',
    ]);
  });

  it('isExecutableDefinitionNode', () => {
    expect(filterNodes(isExecutableDefinitionNode)).toEqual([
      'OperationDefinition',
      'FragmentDefinition',
    ]);
  });

  it('isSelectionNode', () => {
    expect(filterNodes(isSelectionNode)).toEqual([
      'Field',
      'FragmentSpread',
      'InlineFragment',
    ]);
  });

  it('isValueNode', () => {
    expect(filterNodes(isValueNode)).toEqual([
      'Variable',
      'IntValue',
      'FloatValue',
      'StringValue',
      'BooleanValue',
      'NullValue',
      'EnumValue',
      'ListValue',
      'ObjectValue',
    ]);
  });

  it('isConstValueNode', () => {
    expect(isConstValueNode(parseValue('"value"'))).toEqual(true);
    expect(isConstValueNode(parseValue('$var'))).toEqual(false);

    expect(isConstValueNode(parseValue('{ field: "value" }'))).toEqual(true);
    expect(isConstValueNode(parseValue('{ field: $var }'))).toEqual(false);

    expect(isConstValueNode(parseValue('[ "value" ]'))).toEqual(true);
    expect(isConstValueNode(parseValue('[ $var ]'))).toEqual(false);
  });

  it('isTypeNode', () => {
    expect(filterNodes(isTypeNode)).toEqual([
      'NamedType',
      'ListType',
      'NonNullType',
    ]);
  });

  it('isTypeSystemDefinitionNode', () => {
    expect(filterNodes(isTypeSystemDefinitionNode)).toEqual([
      'SchemaDefinition',
      'ResolverTypeDefinition',
      'DataTypeDefinition',
      'DirectiveDefinition',
    ]);
  });

  it('isTypeDefinitionNode', () => {
    expect(filterNodes(isTypeDefinitionNode)).toEqual([
      'ResolverTypeDefinition',
      'DataTypeDefinition',
    ]);
  });
});
