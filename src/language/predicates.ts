import type {
  ASTNode,
  DefinitionNode,
  TypeDefinitionNode,
  TypeNode,
} from './ast';
import { IrisKind } from './kinds';

export const isTypeNode = (node: ASTNode): node is TypeNode =>
  node.kind === IrisKind.NAMED_TYPE ||
  node.kind === IrisKind.LIST_TYPE ||
  node.kind === IrisKind.MAYBE_TYPE;

export const isTypeSystemDefinitionNode = (
  node: ASTNode,
): node is DefinitionNode =>
  isTypeDefinitionNode(node) || node.kind === IrisKind.DIRECTIVE_DEFINITION;

export const isTypeDefinitionNode = (
  node: ASTNode,
): node is TypeDefinitionNode => node.kind === IrisKind.TYPE_DEFINITION;
