import type { Kind } from './kinds';
import type { Source } from './source';
import type { TokenKind } from './tokenKind';

/**
 * Contains a range of UTF-8 character offsets and token references that
 * identify the region of the source from which the AST derived.
 */
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

/**
 * Represents a range of characters represented by a lexical token
 * within a Source.
 */
export class Token {
  /**
   * The kind of Token.
   */
  readonly kind: TokenKind;

  /**
   * The character offset at which this Node begins.
   */
  readonly start: number;

  /**
   * The character offset at which this Node ends.
   */
  readonly end: number;

  /**
   * The 1-indexed line number on which this Token appears.
   */
  readonly line: number;

  /**
   * The 1-indexed column number at which this Token begins.
   */
  readonly column: number;

  /**
   * For non-punctuation tokens, represents the interpreted value of the token.
   *
   * Note: is undefined for punctuation tokens, but typed as string for
   * convenience in the parser.
   */
  readonly value: string;

  /**
   * Tokens exist as nodes in a double-linked-list amongst all tokens
   * including ignored tokens. <SOF> is always the first node and <EOF>
   * the last.
   */
  readonly prev: Token | null;
  readonly next: Token | null;

  constructor(
    kind: TokenKind,
    start: number,
    end: number,
    line: number,
    column: number,
    value?: string,
  ) {
    this.kind = kind;
    this.start = start;
    this.end = end;
    this.line = line;
    this.column = column;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.value = value!;
    this.prev = null;
    this.next = null;
  }

  get [Symbol.toStringTag]() {
    return 'Token';
  }

  toJSON(): {
    kind: TokenKind;
    value?: string;
    line: number;
    column: number;
  } {
    return {
      kind: this.kind,
      value: this.value,
      line: this.line,
      column: this.column,
    };
  }
}

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
  | NonNullTypeNode
  | SchemaDefinitionNode
  | OperationTypeDefinitionNode
  | FieldDefinitionNode
  | ArgumentDefinitionNode
  | ResolverTypeDefinitionNode
  | DataTypeDefinitionNode
  | DirectiveDefinitionNode
  | VariantDefinitionNode;

/**
 * Utility type listing all nodes indexed by their kind.
 */
export type ASTKindToNode = {
  [NodeT in ASTNode as NodeT['kind']]: NodeT;
};

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
  NonNullType: ['type'],

  SchemaDefinition: ['description', 'directives', 'operationTypes'],
  OperationTypeDefinition: ['type'],
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

export interface NameNode {
  readonly kind: Kind.NAME;
  readonly loc?: Location;
  readonly value: string;
}

/** Document */

export interface DocumentNode {
  readonly kind: Kind.DOCUMENT;
  readonly loc?: Location;
  readonly definitions: ReadonlyArray<DefinitionNode>;
}

export type DefinitionNode = TypeSystemDefinitionNode;

export enum OperationTypeNode {
  QUERY = 'query',
  MUTATION = 'mutation',
  SUBSCRIPTION = 'subscription',
}

export interface VariableNode {
  readonly kind: Kind.VARIABLE;
  readonly loc?: Location;
  readonly name: NameNode;
}

export interface ArgumentNode {
  readonly kind: Kind.ARGUMENT;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
}

export interface ConstArgumentNode {
  readonly kind: Kind.ARGUMENT;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}

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

export interface IntValueNode {
  readonly kind: Kind.INT;
  readonly loc?: Location;
  readonly value: string;
}

export interface FloatValueNode {
  readonly kind: Kind.FLOAT;
  readonly loc?: Location;
  readonly value: string;
}

export interface StringValueNode {
  readonly kind: Kind.STRING;
  readonly loc?: Location;
  readonly value: string;
  readonly block?: boolean;
}

export interface BooleanValueNode {
  readonly kind: Kind.BOOLEAN;
  readonly loc?: Location;
  readonly value: boolean;
}

export interface NullValueNode {
  readonly kind: Kind.NULL;
  readonly loc?: Location;
}

export interface EnumValueNode {
  readonly kind: Kind.ENUM;
  readonly loc?: Location;
  readonly value: string;
}

export interface ListValueNode {
  readonly kind: Kind.LIST;
  readonly loc?: Location;
  readonly values: ReadonlyArray<ValueNode>;
}

export interface ConstListValueNode {
  readonly kind: Kind.LIST;
  readonly loc?: Location;
  readonly values: ReadonlyArray<ConstValueNode>;
}

export interface ObjectValueNode {
  readonly kind: Kind.OBJECT;
  readonly loc?: Location;
  readonly fields: ReadonlyArray<ObjectFieldNode>;
}

export interface ConstObjectValueNode {
  readonly kind: Kind.OBJECT;
  readonly loc?: Location;
  readonly fields: ReadonlyArray<ConstObjectFieldNode>;
}

export interface ObjectFieldNode {
  readonly kind: Kind.OBJECT_FIELD;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ValueNode;
}

export interface ConstObjectFieldNode {
  readonly kind: Kind.OBJECT_FIELD;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly value: ConstValueNode;
}

/** Directives */

export interface DirectiveNode {
  readonly kind: Kind.DIRECTIVE;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentNode>;
}

export interface ConstDirectiveNode {
  readonly kind: Kind.DIRECTIVE;
  readonly loc?: Location;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ConstArgumentNode>;
}

/** Type Reference */

export type TypeNode = NamedTypeNode | ListTypeNode | NonNullTypeNode;

export interface NamedTypeNode {
  readonly kind: Kind.NAMED_TYPE;
  readonly loc?: Location;
  readonly name: NameNode;
}

export interface ListTypeNode {
  readonly kind: Kind.LIST_TYPE;
  readonly loc?: Location;
  readonly type: TypeNode;
}

export interface NonNullTypeNode {
  readonly kind: Kind.NON_NULL_TYPE;
  readonly loc?: Location;
  readonly type: NamedTypeNode | ListTypeNode;
}

/** Type System Definition */

export type TypeSystemDefinitionNode =
  | TypeDefinitionNode
  | DirectiveDefinitionNode;

export interface SchemaDefinitionNode {
  readonly kind: Kind.SCHEMA_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly operationTypes: ReadonlyArray<OperationTypeDefinitionNode>;
}

export interface OperationTypeDefinitionNode {
  readonly kind: Kind.OPERATION_TYPE_DEFINITION;
  readonly loc?: Location;
  readonly operation: OperationTypeNode;
  readonly type: NamedTypeNode;
}

/** Type Definition */

export type TypeDefinitionNode =
  | ResolverTypeDefinitionNode
  | DataTypeDefinitionNode;

export interface ArgumentDefinitionNode {
  readonly kind: Kind.ARGUMENT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly defaultValue?: ConstValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
}

export type Role = 'resolver' | 'data';

export type DataTypeDefinitionNode = TypeDefinition<
  Kind.DATA_TYPE_DEFINITION,
  VariantDefinitionNode
>;

export type ResolverTypeDefinitionNode = TypeDefinition<
  Kind.RESOLVER_TYPE_DEFINITION,
  ResolverVariantDefinitionNode
>;

type TypeDefinition<K, Variants> = {
  readonly kind: K;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly variants: ReadonlyArray<Variants>;
};

export type VariantDefinition<F> = {
  readonly kind: Kind.VARIANT_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
  readonly name: NameNode;
  readonly fields?: ReadonlyArray<F>;
};

export type DataFieldDefinitionNode = {
  readonly kind: Kind.FIELD_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly type: TypeNode;
  readonly directives?: ReadonlyArray<ConstDirectiveNode>;
};

export type FieldDefinitionNode = DataFieldDefinitionNode & {
  readonly arguments?: ReadonlyArray<ArgumentDefinitionNode>;
};

export type VariantDefinitionNode = VariantDefinition<FieldDefinitionNode>;
export type ResolverVariantDefinitionNode =
  VariantDefinition<FieldDefinitionNode>;

/** Directive Definitions */

export interface DirectiveDefinitionNode {
  readonly kind: Kind.DIRECTIVE_DEFINITION;
  readonly loc?: Location;
  readonly description?: StringValueNode;
  readonly name: NameNode;
  readonly arguments?: ReadonlyArray<ArgumentDefinitionNode>;
  readonly repeatable: boolean;
  readonly locations: ReadonlyArray<NameNode>;
}
