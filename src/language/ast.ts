import type {
  ArgumentNode,
  BooleanValueNode,
  ConstArgumentNode,
  ConstDirectiveNode,
  ConstListValueNode,
  ConstObjectFieldNode,
  ConstObjectValueNode,
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
  VariableNode,
} from 'graphql';

import type { IrisKind } from './kinds';

export { Location, Token };

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
  | FieldDefinitionNode<Role>
  | ArgumentDefinitionNode
  | TypeDefinitionNode
  | DirectiveDefinitionNode
  | VariantDefinitionNode<Role>
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
  ResolverTypeDefinition: ['description', 'name', 'directives', 'variants'],
  DataTypeDefinition: ['description', 'name', 'directives', 'variants'],
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

/** Values */

export type ValueNode =
  | VariableNode
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ListValueNode
  | ObjectValueNode;

export type ConstValueNode =
  | IntValueNode
  | FloatValueNode
  | StringValueNode
  | BooleanValueNode
  | NullValueNode
  | EnumValueNode
  | ConstListValueNode
  | ConstObjectValueNode;

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

export type FieldDefinitionNode<R extends Role> = {
  readonly kind: IrisKind.FIELD_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly arguments?: ArgumentsDefinitionNode<R>;
};

export type VariantDefinitionNode<R extends Role> = {
  readonly kind: IrisKind.VARIANT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly name: NameNode;
  readonly fields?: ReadonlyArray<FieldDefinitionNode<R>>;
};

type ROLE_TO_KIND = {
  resolver: IrisKind.RESOLVER_TYPE_DEFINITION;
  data: IrisKind.DATA_TYPE_DEFINITION;
};

export type TypeDefinitionNode<R extends Role = Role> = {
  readonly kind: ROLE_TO_KIND[R];
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
