import type { ParseOptions, Source } from 'graphql';
import { syntaxError, TokenKind } from 'graphql';

import type {
  DocumentNode,
  FieldDefinitionNode,
  NameNode,
  TypeDefinitionNode,
  VariantDefinitionNode,
} from '../types/ast';
import { IrisKind } from '../types/kinds';

import { Parser } from './parser';

type FParser<T> = (parser: Parser) => T;

export const parse = (
  source: string | Source,
  options?: ParseOptions,
): DocumentNode => parseDocument(new Parser(source, options));

export const parseDocument: FParser<DocumentNode> = (parser) =>
  parser.node<DocumentNode>(parser._lexer.token, {
    kind: IrisKind.DOCUMENT,
    definitions: parser.many(
      TokenKind.SOF,
      () => parseDefinition(parser),
      TokenKind.EOF,
    ),
  });

export const parseDefinition: FParser<TypeDefinitionNode> = (parser) => {
  // Many definitions begin with a description and require a lookahead.
  const hasDescription = parser.peekDescription();
  const keywordToken = hasDescription
    ? parser._lexer.lookahead()
    : parser._lexer.token;

  if (keywordToken.kind === TokenKind.NAME) {
    const x = parseDefinitions(parser, keywordToken.value);
    if (x) {
      return x;
    }

    if (hasDescription) {
      throw syntaxError(
        parser._lexer.source,
        parser._lexer.token.start,
        'Unexpected description, descriptions are supported only on type definitions.',
      );
    }
  }

  throw parser.unexpected(keywordToken);
};

export const parseDefinitions = (
  parser: Parser,
  keywordToken: string,
): TypeDefinitionNode | undefined => {
  switch (keywordToken) {
    case 'data':
      return parseTypeDefinition(parser);
  }
  return undefined;
};

const parseTypeDefinition = (parser: Parser): TypeDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword('data');
  const name = parser.parseName();
  const directives = parser.parseConstDirectives();
  const variants: ReadonlyArray<VariantDefinitionNode> =
    parseVariantsDefinition(name, parser);
  return parser.node<TypeDefinitionNode>(start, {
    kind: IrisKind.TYPE_DEFINITION,
    description,
    name,
    directives,
    variants,
  });
};

const parseVariantsDefinition = (
  name: NameNode,
  parser: Parser,
): ReadonlyArray<VariantDefinitionNode> => {
  const equal = parser.expectOptionalToken(TokenKind.EQUALS);
  if (!equal) {
    return [];
  }

  switch (parser.lookAhead().kind) {
    case TokenKind.NAME:
      return parser.delimitedMany(TokenKind.PIPE, () =>
        parseVariantDefinition(parser),
      );
    case TokenKind.BRACE_L:
      return [parseVariantDefinition(parser, name)];
    default:
      parser.throwExpected('Variant');
      return [];
  }
};

const parseVariantDefinition = (
  parser: Parser,
  typeName?: NameNode,
): VariantDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = typeName ?? parseVariantName(parser);
  const directives = parser.parseConstDirectives();
  const fields = parseFieldsDefinition(parser);
  return parser.node<VariantDefinitionNode>(start, {
    kind: IrisKind.VARIANT_DEFINITION,
    description,
    name,
    directives,
    fields,
    isTypeVariantNode: Boolean(typeName),
  });
};

const parseVariantName = (parser: Parser): NameNode => {
  const { value } = parser.lookAhead();
  if (value === 'true' || value === 'false' || value === 'null') {
    parser.invalidToken('is reserved and cannot be used for an enum value');
  }
  return parser.parseName();
};

const parseFieldsDefinition = (
  parser: Parser,
): ReadonlyArray<FieldDefinitionNode> | undefined => {
  const nodes = [];
  if (parser.expectOptionalToken(TokenKind.BRACE_L)) {
    while (!parser.expectOptionalToken(TokenKind.BRACE_R)) {
      nodes.push(parseFieldDefinition(parser)());
    }
    return nodes;
  }
  return undefined;
};

const parseFieldDefinition = (parser: Parser) => (): FieldDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = parser.parseName();
  parser.expectToken(TokenKind.COLON);
  const type = parser.parseTypeReference();
  const directives = parser.parseConstDirectives();
  return parser.node<FieldDefinitionNode>(start, {
    kind: IrisKind.FIELD_DEFINITION,
    description,
    name,
    type,
    directives,
  });
};
