import { Kind } from 'graphql';

import type {
  ASTNode,
  ConstValueNode,
  TypeDefinitionNode,
  TypeNode,
  TypeSystemDefinitionNode,
  ValueNode,
} from './ast';
import { IrisKind } from './kinds';

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
    node.kind === IrisKind.NAMED_TYPE ||
    node.kind === IrisKind.LIST_TYPE ||
    node.kind === IrisKind.MAYBE_TYPE
  );
}

export function isTypeSystemDefinitionNode(
  node: ASTNode,
): node is TypeSystemDefinitionNode {
  return (
    isTypeDefinitionNode(node) || node.kind === IrisKind.DIRECTIVE_DEFINITION
  );
}

export function isTypeDefinitionNode(
  node: ASTNode,
): node is TypeDefinitionNode {
  return (
    node.kind === IrisKind.RESOLVER_TYPE_DEFINITION ||
    node.kind === IrisKind.DATA_TYPE_DEFINITION
  );
}
