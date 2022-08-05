export enum IrisKind {
  ARGUMENT_DEFINITION = 'InputValueDefinition',
  NAMED_TYPE = 'NamedType',
  LIST_TYPE = 'ListType',
  MAYBE_TYPE = 'MaybeType',
  FIELD_DEFINITION = 'FieldDefinition',
  VARIANT_DEFINITION = 'VariantDefinition',
  TYPE_DEFINITION = 'TypeDefinition',
  DIRECTIVE_DEFINITION = 'DirectiveDefinition',
  DOCUMENT = 'Document',
}

export enum TokenKind {
  SOF = '<SOF>',
  EOF = '<EOF>',
  DOLLAR = '$',
  AMP = '&',
  PAREN_L = '(',
  PAREN_R = ')',
  SPREAD = '...',
  COLON = ':',
  EQUALS = '=',
  AT = '@',
  BRACKET_L = '[',
  BRACKET_R = ']',
  BRACE_L = '{',
  PIPE = '|',
  BRACE_R = '}',
  NAME = 'Name',
  INT = 'Int',
  FLOAT = 'Float',
  STRING = 'String',
  BLOCK_STRING = 'BlockString',
  COMMENT = 'Comment',
  QUESTION_MARK = '?',
  BANG = '!',
}

export const scalarNames = ['String', 'Int', 'Float', 'ID', 'Boolean'];

export enum IrisDirectiveLocation {
  // LEGACY
  QUERY = 'QUERY',
  MUTATION = 'MUTATION',
  SUBSCRIPTION = 'SUBSCRIPTION',
  FIELD = 'FIELD',
  FRAGMENT_DEFINITION = 'FRAGMENT_DEFINITION',
  FRAGMENT_SPREAD = 'FRAGMENT_SPREAD',
  INLINE_FRAGMENT = 'INLINE_FRAGMENT',
  // IRIS
  DATA_DEFINITION = 'DATA_DEFINITION',
  VARIANT_DEFINITION = 'VARIANT_DEFINITION',
  FIELD_DEFINITION = 'FIELD_DEFINITION',
  ARGUMENT_DEFINITION = 'ARGUMENT_DEFINITION',
}
