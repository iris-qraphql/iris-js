import type {
  ArgumentNode,
  BooleanValueNode,
  ConstArgumentNode,
  ConstDirectiveNode,
  ConstListValueNode,
  ConstObjectFieldNode,
  ConstObjectValueNode,
  ConstValueNode,
  DirectiveNode,
  EnumValueNode,
  FloatValueNode,
  IntValueNode,
  Kind,
  ListValueNode,
  Location,
  NullValueNode,
  ObjectFieldNode,
  ObjectValueNode,
  StringValueNode,
  Token,
  ValueNode,
  VariableNode,
} from 'graphql';

import { IrisKind } from './kinds';

/**
 * The list of all possible AST node types.
 */
export type ASTNode =
  | NameNode
  | DocumentNode
  | VariableNode
  | ArgumentNode
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ListValueNode
  | ObjectValueNode
  | ObjectFieldNode
  | DirectiveNode
  | NamedTypeNode
  | ListTypeNode
  | FieldDefinitionNode
  | ArgumentDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode
  | VariantDefinitionNode
  | MaybeTypeNode;

/**
 * @internal
 */
export const QueryDocumentKeys: {
  [NodeT in ASTNode as NodeT['kind']]: ReadonlyArray<keyof NodeT>;
} = {
  Name: [],
  Document: ['definitions'],
  Variable: ['name'],
  Argument: ['name', 'value'],
  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ['values'],
  ObjectValue: ['fields'],
  ObjectField: ['name', 'value'],
  Directive: ['name', 'arguments'],
  NamedType: ['name'],
  ListType: ['type'],
  MaybeType: ['type'],
  FieldDefinition: ['description', 'name', 'arguments', 'type', 'directives'],
  InputValueDefinition: [
    'description',
    'name',
    'type',
    'defaultValue',
    'directives',
  ],
  TypeDefinition: ['description', 'name', 'directives', 'variants'],
  VariantDefinition: ['name', 'fields'],
  DirectiveDefinition: ['description', 'name', 'arguments', 'locations'],
};

const kindValues = new Set<string>(Object.keys(QueryDocumentKeys));
/**
 * @internal
 */
export function isNode(maybeNode: any): maybeNode is ASTNode {
  const maybeKind = maybeNode?.kind;
  return typeof maybeKind === 'string' && kindValues.has(maybeKind);
}

/** Name */

export type NameNode = {
  readonly kind: Kind.NAME;
  readonly loc?: Location;
  readonly value: string;
};

/** Document */

export type DocumentNode = {
  readonly kind: IrisKind.DOCUMENT;
  readonly loc?: Location;
  readonly definitions: ReadonlyArray<DefinitionNode>;
};

export type {
  VariableNode,
  IntValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  NullValueNode,
  EnumValueNode,
  ListValueNode,
  ConstListValueNode,
  ObjectValueNode,
  ConstObjectValueNode,
  ObjectFieldNode,
  ConstObjectFieldNode,
  ArgumentNode,
  ConstArgumentNode,
  ConstDirectiveNode,
  DirectiveNode,
  ValueNode,
  ConstValueNode,
  Location,
  Token,
};

/** Type Reference */

export type WrapperKind = 'LIST' | 'MAYBE';

export type TypeNode = NamedTypeNode | ListTypeNode | MaybeTypeNode;

export type NamedTypeNode = {
  readonly kind: IrisKind.NAMED_TYPE;
  readonly loc?: Location;
  readonly name: NameNode;
};

export type ListTypeNode = {
  readonly kind: IrisKind.LIST_TYPE;
  readonly loc?: Location;
  readonly type: TypeNode;
};

export type MaybeTypeNode = {
  readonly kind: IrisKind.MAYBE_TYPE;
  readonly loc?: Location;
  readonly type: NamedTypeNode | ListTypeNode;
};

/** Type Definition */

export type DefinitionNode = TypeDefinitionNode | DirectiveDefinitionNode;

export type Role = 'resolver' | 'data';

export type ArgumentDefinitionNode = {
  readonly kind: IrisKind.ARGUMENT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type ArgumentsDefinitionNode<R extends Role> = R extends 'resolver'
  ? ReadonlyArray<ArgumentDefinitionNode>
  : undefined;

export type FieldDefinitionNode<R extends Role = Role> = {
  readonly kind: IrisKind.FIELD_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly arguments?: ArgumentsDefinitionNode<R>;
};

export type VariantDefinitionNode<R extends Role = Role> = {
  readonly kind: IrisKind.VARIANT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly name: NameNode;
  readonly fields?: ReadonlyArray<FieldDefinitionNode<R>>;
};

export type TypeDefinitionNode<R extends Role = Role> = {
  readonly kind: IrisKind.TYPE_DEFINITION;
  readonly role: R;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly variants: ReadonlyArray<VariantDefinitionNode<R>>;
};

export interface DirectiveDefinitionNode {
  readonly kind: IrisKind.DIRECTIVE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentDefinitionNode>;
  readonly repeatable: boolean;
  readonly locations: ReadonlyArray<NameNode>;
}

export const isTypeSystemDefinitionNode = (
  node: ASTNode,
): node is DefinitionNode =>
  isTypeDefinitionNode(node) || node.kind === IrisKind.DIRECTIVE_DEFINITION;

export const isTypeDefinitionNode = (
  node: ASTNode,
): node is TypeDefinitionNode => node.kind === IrisKind.TYPE_DEFINITION;

export const isTypeVariantNode = ({ name, variants }: TypeDefinitionNode) => {
  const typeName = name.value;
  const [variant] = variants;

  if (variants.length === 0) {
    return true;
  }

  return (
    variants.length === 1 &&
    variant.name.value === typeName &&
    variant.fields !== undefined
  );
};
