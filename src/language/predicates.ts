import { Kind } from 'graphql';

import type {
  ASTNode,
  ConstValueNode,
  DefinitionNode,
  TypeDefinitionNode,
  TypeNode,
  TypeSystemDefinitionNode,
  ValueNode,
} from './ast';
import { IrisKind } from './kinds';

export function isDefinitionNode(node: ASTNode): node is DefinitionNode {
  return isTypeSystemDefinitionNode(node);
}

export function isValueNode(node: ASTNode): node is ValueNode {
  return (
    node.kind === Kind.VARIABLE ||
    node.kind === Kind.INT ||
    node.kind === Kind.FLOAT ||
    node.kind === Kind.STRING ||
    node.kind === Kind.BOOLEAN ||
    node.kind === Kind.NULL ||
    node.kind === Kind.ENUM ||
    node.kind === Kind.LIST ||
    node.kind === Kind.OBJECT
  );
}

export function isConstValueNode(node: ASTNode): node is ConstValueNode {
  return (
    isValueNode(node) &&
    (node.kind === Kind.LIST
      ? node.values.some(isConstValueNode)
      : node.kind === Kind.OBJECT
      ? node.fields.some((field) => isConstValueNode(field.value))
      : node.kind !== Kind.VARIABLE)
  );
}

export function isTypeNode(node: ASTNode): node is TypeNode {
  return (
    node.kind === Kind.NAMED_TYPE ||
    node.kind === Kind.LIST_TYPE ||
    node.kind === Kind.NON_NULL_TYPE
  );
}

export function isTypeSystemDefinitionNode(
  node: ASTNode,
): node is TypeSystemDefinitionNode {
  return isTypeDefinitionNode(node) || node.kind === Kind.DIRECTIVE_DEFINITION;
}

export function isTypeDefinitionNode(
  node: ASTNode,
): node is TypeDefinitionNode {
  return (
    node.kind === IrisKind.RESOLVER_TYPE_DEFINITION ||
    node.kind === IrisKind.DATA_TYPE_DEFINITION
  );
}
