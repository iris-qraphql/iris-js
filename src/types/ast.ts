import type { Kind } from 'graphql';
import { Token } from 'graphql';

import type { Source } from '../parsing/source';
import type { Maybe } from '../utils/type-level';

import { GQLKind, IrisDirectiveLocation, IrisKind } from './kinds';

export { specifiedScalarTypes } from 'graphql';

export type ASTNode =
  | NameNode
  | DocumentNode
  | ArgumentNode
  | StringValueNode
  | NullValueNode
  | DirectiveNode
  | NamedTypeNode
  | ListTypeNode
  | FieldDefinitionNode
  | ArgumentDefinitionNode
  | TypeDefinitionNode
  | VariantDefinitionNode
  | MaybeTypeNode;

export type ValueNode = NullValueNode | StringValueNode;

/**
 * @internal
 */
export const QueryDocumentKeys: {
  [NodeT in ASTNode as NodeT['kind']]: ReadonlyArray<keyof NodeT>;
} = {
  Name: [],
  Document: ['definitions'],
  Argument: ['name', 'value'],
  StringValue: [],
  NullValue: [],
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
  VariantDefinition: ['description', 'name', 'fields', 'directives'],
};

const kindValues = new Set<string>(Object.keys(QueryDocumentKeys));
/**
 * @internal
 */
export function isNode(maybeNode: any): maybeNode is ASTNode {
  const maybeKind = maybeNode?.kind;
  return typeof maybeKind === 'string' && kindValues.has(maybeKind);
}

export class Location {
  /**
   * The character offset at which this Node begins.
   */
  readonly start: number;

  /**
   * The character offset at which this Node ends.
   */
  readonly end: number;

  /**
   * The Token at which this Node begins.
   */
  readonly startToken: Token;

  /**
   * The Token at which this Node ends.
   */
  readonly endToken: Token;

  /**
   * The Source document the AST represents.
   */
  readonly source: Source;

  constructor(startToken: Token, endToken: Token, source: Source) {
    this.start = startToken.start;
    this.end = endToken.end;
    this.startToken = startToken;
    this.endToken = endToken;
    this.source = source;
  }

  get [Symbol.toStringTag]() {
    return 'Location';
  }

  toJSON(): { start: number; end: number } {
    return { start: this.start, end: this.end };
  }
}

// VALUE
export type StringValueNode = {
  readonly kind: Kind.STRING;
  readonly loc?: Location;
  readonly value: string;
  readonly block?: boolean;
};

export type NullValueNode = {
  readonly kind: Kind.NULL;
  readonly loc?: Location;
};

export type ArgumentNode = {
  readonly kind: Kind.ARGUMENT;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
};

export type DirectiveNode = {
  readonly kind: Kind.DIRECTIVE;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode>;
};

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
  readonly definitions: ReadonlyArray<TypeDefinitionNode>;
};

export { Token };

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

export type ArgumentDefinitionNode = {
  readonly kind: IrisKind.ARGUMENT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ValueNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
};

export type FieldDefinitionNode = {
  readonly kind: IrisKind.FIELD_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
};

export type VariantDefinitionNode = {
  readonly kind: IrisKind.VARIANT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
  readonly isTypeVariantNode: boolean;
  readonly name: NameNode;
  readonly fields?: ReadonlyArray<FieldDefinitionNode>;
};

export type TypeDefinitionNode = {
  readonly kind: IrisKind.TYPE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<DirectiveNode>;
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

export const isRequiredArgument = (arg: ArgumentDefinitionNode) =>
  arg.type.kind !== IrisKind.MAYBE_TYPE && arg.defaultValue === undefined;

export const getDeprecationReason = (
  node: ASTNode & Pick<TypeDefinitionNode, 'directives'>,
): Maybe<string> => {
  const deprecated = node.directives?.find(
    (d) => d.name.value === 'deprecated',
  );

  if (!deprecated) {
    return undefined;
  }

  const reason = deprecated.arguments?.[0]?.value as Maybe<StringValueNode>;
  return reason?.value ?? '';
};

type IrisDirective = {
  name: string;
  description?: string;
  locations: ReadonlyArray<IrisDirectiveLocation>;
  args: ReadonlyArray<ArgumentDefinitionNode>;
  astNode?: DirectiveDefinitionNode;
};

export const specifiedDirectives: ReadonlyArray<IrisDirective> = Object.freeze([
  {
    name: 'deprecated',
    description: 'Marks an element of a GraphQL schema as no longer supported.',
    locations: [
      IrisDirectiveLocation.FIELD_DEFINITION,
      IrisDirectiveLocation.ARGUMENT_DEFINITION,
      IrisDirectiveLocation.VARIANT_DEFINITION,
    ],
    args: [
      {
        kind: IrisKind.ARGUMENT_DEFINITION,
        name: { value: 'reason', kind: GQLKind.NAME },
        description: {
          kind: GQLKind.STRING,
          value:
            'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
        },
        defaultValue: { value: '', kind: GQLKind.STRING },
        type: {
          kind: IrisKind.NAMED_TYPE,
          name: { value: 'string', kind: GQLKind.NAME },
        },
      },
    ],
  },
]);
