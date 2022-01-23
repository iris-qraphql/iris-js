import type {
  DataTypeDefinitionNode,
  DefinitionNode,
  FieldDefinitionNode,
  NameNode,
  ResolverTypeDefinitionNode,
  ResolverVariantDefinitionNode,
  Role,
  VariantDefinitionNode,
} from './ast';
import { Kind } from './kinds';
import type { Parser } from './parser';
import { TokenKind } from './tokenKind';

export const parseDefinitions = (
  parser: Parser,
  keywordToken: string,
): DefinitionNode | undefined => {
  switch (keywordToken) {
    case 'scalar':
      return parser.parseScalarTypeDefinition();
    case 'resolver':
      return parseResolverTypeDefinition(parser);
    case 'data':
      return parseDataTypeDefinition(parser, 'data');
    case 'directive':
      return parser.parseDirectiveDefinition();
  }

  return undefined;
};

const parseResolverTypeDefinition = (
  parser: Parser,
): ResolverTypeDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword('resolver');
  const name = parser.parseName();
  const directives = parser.parseConstDirectives();
  const isEquals = parser.expectOptionalToken(TokenKind.EQUALS);
  const afterEquals = parser.lookAhead().kind;

  if (!isEquals) {
    return parser.node<ResolverTypeDefinitionNode>(start, {
      kind: Kind.RESOLVER_TYPE_DEFINITION,
      description,
      name,
      directives,
      variants: [{ kind: Kind.VARIANT_DEFINITION, name, fields: [] }],
    });
  }

  if (isEquals && ![TokenKind.BRACE_L, TokenKind.NAME].includes(afterEquals)) {
    parser.throwExpected('Variant');
  }

  const isUnion = parser.lookAhead().kind !== TokenKind.BRACE_L;

  if (isEquals && isUnion) {
    const variants = parser.delimitedMany(TokenKind.PIPE, () =>
      parseResolverVariantDefinition(parser),
    );

    return parser.node<ResolverTypeDefinitionNode>(start, {
      kind: Kind.RESOLVER_TYPE_DEFINITION,
      description,
      name,
      directives,
      variants,
    });
  }

  const fields = parseFieldsDefinition(parser);

  return parser.node<ResolverTypeDefinitionNode>(start, {
    kind: Kind.RESOLVER_TYPE_DEFINITION,
    description,
    name,
    directives,
    variants: [{ kind: Kind.VARIANT_DEFINITION, name, fields }],
  });
};

const parseResolverVariantDefinition = (
  parser: Parser,
  typeName?: NameNode,
): ResolverVariantDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = typeName ?? parseVariantName(parser);
  const directives = parser.parseConstDirectives();
  const fields = parseFieldsDefinition(parser);
  return parser.node<ResolverVariantDefinitionNode>(start, {
    kind: Kind.VARIANT_DEFINITION,
    description,
    name,
    directives,
    fields,
  });
};

const parseFieldsDefinition = (
  parser: Parser,
): Array<FieldDefinitionNode> | undefined =>
  parser.lookAhead().kind === TokenKind.BRACE_L
    ? parser.optionalMany(
        TokenKind.BRACE_L,
        parseFieldDefinition(parser),
        TokenKind.BRACE_R,
      )
    : undefined;

const parseFieldDefinition = (parser: Parser) => (): FieldDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = parser.parseName();
  const args = parser.parseArgumentDefs();
  parser.expectToken(TokenKind.COLON);
  const type = parser.parseTypeReference();
  const directives = parser.parseConstDirectives();
  return parser.node<FieldDefinitionNode>(start, {
    kind: Kind.FIELD_DEFINITION,
    description,
    name,
    arguments: args,
    type,
    directives,
  });
};

export const parseDataTypeDefinition = (
  parser: Parser,
  role: Role,
): DataTypeDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword(role);
  const name = parser.parseName();
  const directives = parser.parseConstDirectives();
  const isEquals = parser.expectOptionalToken(TokenKind.EQUALS);
  const isUnion = parser.lookAhead().kind !== TokenKind.BRACE_L;
  const variants: ReadonlyArray<VariantDefinitionNode> =
    isEquals && isUnion
      ? parser.delimitedMany(TokenKind.PIPE, () =>
          parseVariantDefinition(parser),
        )
      : [parseVariantDefinition(parser, name)];
  return parser.node<DataTypeDefinitionNode>(start, {
    kind: Kind.DATA_TYPE_DEFINITION,
    description,
    name,
    directives,
    variants,
  });
};

const parseVariantName = (parser: Parser): NameNode => {
  const { value } = parser.lookAhead();
  if (value === 'true' || value === 'false' || value === 'null') {
    parser.invalidToken('is reserved and cannot be used for an enum value');
  }
  return parser.parseName();
};

const parseVariantDefinition = (
  parser: Parser,
  typeName?: NameNode,
): VariantDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = typeName ?? parseVariantName(parser);
  const directives = parser.parseConstDirectives();
  const fields = parseVariantFields(parser);
  return parser.node<VariantDefinitionNode>(start, {
    kind: Kind.VARIANT_DEFINITION,
    description,
    name,
    directives,
    fields,
  });
};

const parseVariantFields = (parser: Parser) => {
  const nodes = [];
  if (parser.expectOptionalToken(TokenKind.BRACE_L)) {
    while (!parser.expectOptionalToken(TokenKind.BRACE_R)) {
      nodes.push(parser.parseInputValueDef());
    }
    return nodes;
  }
  return [];
};
