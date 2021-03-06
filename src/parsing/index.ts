import type { ParseOptions, Source } from 'graphql';
import { syntaxError, TokenKind } from 'graphql';

import type {
  ArgumentsDefinitionNode,
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  NameNode,
  Role,
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

export const parseDefinition: FParser<DefinitionNode> = (parser) => {
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
): DefinitionNode | undefined => {
  switch (keywordToken) {
    case 'resolver':
      return parseTypeDefinition('resolver', parser);
    case 'data':
      return parseTypeDefinition('data', parser);
    case 'directive':
      return parser.parseDirectiveDefinition();
  }

  return undefined;
};

const parseTypeDefinition = <R extends Role>(
  role: R,
  parser: Parser,
): TypeDefinitionNode<R> => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword(role);
  const name = parser.parseName();
  const directives = parser.parseConstDirectives();
  const variants: ReadonlyArray<VariantDefinitionNode<R>> =
    parseVariantsDefinition(role, name, parser);
  return parser.node<TypeDefinitionNode<R>>(start, {
    kind: IrisKind.TYPE_DEFINITION,
    role,
    description,
    name,
    directives,
    variants,
  });
};

const parseVariantsDefinition = <R extends Role>(
  role: R,
  name: NameNode,
  parser: Parser,
): ReadonlyArray<VariantDefinitionNode<R>> => {
  const equal = parser.expectOptionalToken(TokenKind.EQUALS);
  if (!equal) {
    return [];
  }

  switch (parser.lookAhead().kind) {
    case TokenKind.NAME:
      return parser.delimitedMany(TokenKind.PIPE, () =>
        parseVariantDefinition(role, parser),
      );
    case TokenKind.BRACE_L:
      return [parseVariantDefinition(role, parser, name)];
    default:
      parser.throwExpected('Variant');
      return [];
  }
};

const parseVariantDefinition = <R extends Role>(
  role: R,
  parser: Parser,
  typeName?: NameNode,
): VariantDefinitionNode<R> => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = typeName ?? parseVariantName(parser);
  const directives = parser.parseConstDirectives();
  const fields = parseFieldsDefinition(role, parser);
  return parser.node<VariantDefinitionNode<R>>(start, {
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
): ReadonlyArray<FieldDefinitionNode<R>> | undefined => {
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
  (): FieldDefinitionNode<R> => {
    const start = parser.lookAhead();
    const description = parser.parseDescription();
    const name = parser.parseName();
    const args = (
      role === 'resolver' ? parser.parseArgumentDefs() : undefined
    ) as ArgumentsDefinitionNode<R>;
    parser.expectToken(TokenKind.COLON);
    const type = parser.parseTypeReference();
    const directives = parser.parseConstDirectives();
    return parser.node<FieldDefinitionNode<R>>(start, {
      kind: IrisKind.FIELD_DEFINITION,
      description,
      name,
      arguments: args,
      type,
      directives,
    });
  };
