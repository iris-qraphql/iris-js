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

import type { Maybe } from '../utils/type-level';

import { IrisKind } from './kinds';

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
  FieldDefinition: ['description', 'name', 'type', 'directives'],
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

export type WrapperKind = 'LIST' | 'MAYBE' | 'NAMED';

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

export type ArgumentDefinitionNode = {
  readonly kind: IrisKind.ARGUMENT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type FieldDefinitionNode = {
  readonly kind: IrisKind.FIELD_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type VariantDefinitionNode = {
  readonly kind: IrisKind.VARIANT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly isTypeVariantNode: boolean;
  readonly name: NameNode;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
  readonly deprecation?: string;
};

export type TypeDefinitionNode = {
  readonly kind: IrisKind.TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly variants: ReadonlyArray<VariantDefinitionNode>;
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

export const isDirectiveDefinitionNode = (
  node: ASTNode,
): node is DirectiveDefinitionNode =>
  node.kind === IrisKind.DIRECTIVE_DEFINITION;

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

export const getRefTypeName = (node: TypeNode): NameNode => {
  switch (node.kind) {
    case IrisKind.NAMED_TYPE:
      return node.name;
    case IrisKind.LIST_TYPE:
      return getRefTypeName(node.type);
    case IrisKind.MAYBE_TYPE:
      return getRefTypeName(node.type);
  }
};

export const getVariant = (
  { variants }: TypeDefinitionNode,
  name?: string,
): Maybe<VariantDefinitionNode> =>
  name ? variants.find((v) => v.name.value === name) : variants[0];

export const getField = (name: string, v: Maybe<VariantDefinitionNode>) =>
  v?.fields?.find((f) => f.name.value === name);

export const isRequiredArgument = (arg: ArgumentDefinitionNode) =>
  arg.type.kind !== IrisKind.MAYBE_TYPE;
