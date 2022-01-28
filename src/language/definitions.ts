import { TokenKind } from 'graphql';

import type {
  _FieldDefinitionNode,
  _VariantDefinitionNode,
  DataTypeDefinitionNode,
  DefinitionNode,
  FieldDefinitionNode,
  NameNode,
  ResolverTypeDefinitionNode,
  Role,
  VariantDefinitionNode,
} from './ast';
import { IrisKind } from './kinds';
import type { Parser } from './parser';

export const parseDefinitions = (
  parser: Parser,
  keywordToken: string,
): DefinitionNode | undefined => {
  switch (keywordToken) {
    case 'resolver':
      return parseResolverTypeDefinition(parser);
    case 'data':
      return parseDataTypeDefinition('data', parser);
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
      kind: IrisKind.RESOLVER_TYPE_DEFINITION,
      description,
      name,
      directives,
      variants: [{ kind: IrisKind.VARIANT_DEFINITION, name, fields: [] }],
    });
  }

  if (isEquals && ![TokenKind.BRACE_L, TokenKind.NAME].includes(afterEquals)) {
    parser.throwExpected('Variant');
  }

  const isUnion = parser.lookAhead().kind !== TokenKind.BRACE_L;

  if (isEquals && isUnion) {
    const variants = parser.delimitedMany(TokenKind.PIPE, () =>
      parseVariantDefinition('resolver', parser),
    );

    return parser.node<ResolverTypeDefinitionNode>(start, {
      kind: IrisKind.RESOLVER_TYPE_DEFINITION,
      description,
      name,
      directives,
      variants,
    });
  }

  const fields = parseFieldsDefinition('resolver', parser);

  return parser.node<ResolverTypeDefinitionNode>(start, {
    kind: IrisKind.RESOLVER_TYPE_DEFINITION,
    description,
    name,
    directives,
    variants: [{ kind: IrisKind.VARIANT_DEFINITION, name, fields }],
  });
};

export const parseDataTypeDefinition = (
  role: Role,
  parser: Parser,
): DataTypeDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword(role);
  const name = parser.parseName();
  const directives = parser.parseConstDirectives();
  const variants = parseVariantsDefinition('data', name, parser);
  return parser.node<DataTypeDefinitionNode>(start, {
    kind: IrisKind.DATA_TYPE_DEFINITION,
    description,
    name,
    directives,
    variants,
  });
};

export const parseVariantsDefinition = (
  role: Role,
  name: NameNode,
  parser: Parser,
): ReadonlyArray<VariantDefinitionNode> => {
  const isEquals = parser.expectOptionalToken(TokenKind.EQUALS);
  const isUnion = parser.lookAhead().kind !== TokenKind.BRACE_L;
  return isEquals && isUnion
    ? parser.delimitedMany(TokenKind.PIPE, () =>
        parseVariantDefinition(role, parser),
      )
    : [parseVariantDefinition(role, parser, name)];
};

const parseVariantDefinition = <R extends Role>(
  role: R,
  parser: Parser,
  typeName?: NameNode,
): _VariantDefinitionNode<R> => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = typeName ?? parseVariantName(parser);
  const directives = parser.parseConstDirectives();
  const fields = parseFieldsDefinition(role, parser);
  return parser.node<VariantDefinitionNode>(start, {
    kind: IrisKind.VARIANT_DEFINITION,
    description,
    name,
    directives,
    fields,
  });
};

const parseVariantName = (parser: Parser): NameNode => {
  const { value } = parser.lookAhead();
  if (value === 'true' || value === 'false' || value === 'null') {
    parser.invalidToken('is reserved and cannot be used for an enum value');
  }
  return parser.parseName();
};

const parseFieldsDefinition = <R extends Role>(
  role: R,
  parser: Parser,
): ReadonlyArray<_FieldDefinitionNode<R>> | undefined => {
  const nodes = [];
  if (parser.expectOptionalToken(TokenKind.BRACE_L)) {
    while (!parser.expectOptionalToken(TokenKind.BRACE_R)) {
      nodes.push(parseFieldDefinition(role, parser)());
    }
    return nodes;
  }
  return undefined;
};

const parseFieldDefinition =
  <R extends Role>(role: R, parser: Parser) =>
  (): _FieldDefinitionNode<R> => {
    const start = parser.lookAhead();
    const description = parser.parseDescription();
    const name = parser.parseName();
    const args = role === 'resolver' ? parser.parseArgumentDefs() : undefined;
    parser.expectToken(TokenKind.COLON);
    const type = parser.parseTypeReference();
    const directives = parser.parseConstDirectives();
    return parser.node<FieldDefinitionNode>(start, {
      kind: IrisKind.FIELD_DEFINITION,
      description,
      name,
      arguments: args,
      type,
      directives,
    });
  };
