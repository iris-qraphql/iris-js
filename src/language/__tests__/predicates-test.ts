import type { ASTNode } from '../ast';
import { KINDS } from '../kinds';
import { parseValue } from '../parser';
import {
  isConstValueNode,
  isTypeDefinitionNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isValueNode,
} from '../predicates';

function filterNodes(predicate: (node: ASTNode) => boolean): Array<string> {
  return KINDS.filter(
    // @ts-expect-error create node only with kind
    (kind) => predicate({ kind }),
  );
}

describe('AST node predicates', () => {
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
      'DirectiveDefinition',
      'ResolverTypeDefinition',
      'DataTypeDefinition',
    ]);
  });

  it('isTypeDefinitionNode', () => {
    expect(filterNodes(isTypeDefinitionNode)).toEqual([
      'ResolverTypeDefinition',
      'DataTypeDefinition',
    ]);
  });
});
