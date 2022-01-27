/**
 * The set of allowed kind values for AST nodes.
 */
export enum Kind {
  /** Name */
  NAME = 'Name',

  /** Document */
  DOCUMENT = 'Document',
  ARGUMENT = 'Argument',

  /** Values */
  VARIABLE = 'Variable',
  INT = 'IntValue',
  FLOAT = 'FloatValue',
  STRING = 'StringValue',
  BOOLEAN = 'BooleanValue',
  NULL = 'NullValue',
  ENUM = 'EnumValue',
  LIST = 'ListValue',
  OBJECT = 'ObjectValue',
  OBJECT_FIELD = 'ObjectField',

  /** Directives */
  DIRECTIVE = 'Directive',

  /** Types */
  NAMED_TYPE = 'NamedType',
  LIST_TYPE = 'ListType',
  NON_NULL_TYPE = 'NonNullType',

  ARGUMENT_DEFINITION = 'InputValueDefinition',
  /** Type Definitions */
  FIELD_DEFINITION = 'FieldDefinition',
  RESOLVER_TYPE_DEFINITION = 'ResolverTypeDefinition',
  DATA_TYPE_DEFINITION = 'DataTypeDefinition',
  VARIANT_DEFINITION = 'VariantDefinition',

  /** Directive Definitions */
  DIRECTIVE_DEFINITION = 'DirectiveDefinition',
}
