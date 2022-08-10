import { syntaxError } from '../error';
import type {
  ArgumentNode,
  DirectiveNode,
  DocumentNode,
  FieldDefinitionNode,
  ListTypeNode,
  MaybeTypeNode,
  NamedTypeNode,
  NameNode,
  NullValueNode,
  StringValueNode,
  TypeDefinitionNode,
  TypeNode,
  ValueNode,
  VariantDefinitionNode,
} from '../types/ast';
import { GQLKind as Kind, IrisKind, TokenKind } from '../types/kinds';
import type { Maybe } from '../utils/type-level';

import type { FParser } from './parser';
import { Parser } from './parser';

const parse = (source: string): DocumentNode =>
  parseDocument(new Parser(source));

const parseDocument: FParser<DocumentNode> = (parser) =>
  parser.node<DocumentNode>(parser._lexer.token, {
    kind: IrisKind.DOCUMENT,
    definitions: parser.many(
      TokenKind.SOF,
      () => parseDefinition(parser),
      TokenKind.EOF,
    ),
  });

const peekDescription: FParser<boolean> = (p) =>
  p.peek(TokenKind.STRING) || p.peek(TokenKind.BLOCK_STRING);

const parseDefinition: FParser<TypeDefinitionNode> = (parser) => {
  // Many definitions begin with a description and require a lookahead.
  const hasDescription = peekDescription(parser);
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

const parseDefinitions = (
  parser: Parser,
  keywordToken: string,
): TypeDefinitionNode | undefined => {
  switch (keywordToken) {
    case 'data':
      return parseTypeDefinition(parser);
  }
  return undefined;
};

const parseName: FParser<NameNode> = (p): NameNode => {
  const token = p.expectToken(TokenKind.NAME);

  if (token.value.startsWith('__')) {
    throw syntaxError(
      p._lexer.source,
      p._lexer.token.start,
      `Name "${token.value}" must not begin with "__", which is reserved by GraphQL introspection.`,
    );
  }

  return p.node<NameNode>(token, {
    kind: Kind.NAME,
    value: token.value,
  });
};

const parseValueLiteral: FParser<ValueNode> = (p) => {
  const token = p._lexer.token;
  switch (token.kind) {
    case TokenKind.STRING:
    case TokenKind.BLOCK_STRING:
      return parseStringLiteral(p);
    case TokenKind.NAME:
      p._lexer.advance();
      switch (token.value) {
        case 'null':
          return p.node<NullValueNode>(token, { kind: Kind.NULL });
        default:
          throw p.unexpected();
      }
    default:
      throw p.unexpected();
  }
};
const parseStringLiteral: FParser<StringValueNode> = (p) => {
  const token = p._lexer.token;
  p._lexer.advance();
  return p.node<StringValueNode>(token, {
    kind: Kind.STRING,
    value: token.value,
    block: token.kind === TokenKind.BLOCK_STRING,
  });
};

const parseArgument: FParser<ArgumentNode> = (p) => {
  const start = p._lexer.token;
  const name = parseName(p);

  p.expectToken(TokenKind.COLON);
  return p.node<ArgumentNode>(start, {
    kind: Kind.ARGUMENT,
    name,
    value: parseValueLiteral(p),
  });
};

const parseArguments: FParser<ReadonlyArray<ArgumentNode>> = (p) =>
  p.token(TokenKind.PAREN_L)
    ? p.manyTill(() => parseArgument(p), TokenKind.PAREN_R)
    : [];

const parseDirective: FParser<DirectiveNode> = (p) => {
  const start = p._lexer.token;
  p.expectToken(TokenKind.AT);
  return p.node<DirectiveNode>(start, {
    kind: Kind.DIRECTIVE,
    name: parseName(p),
    arguments: parseArguments(p),
  });
};

const parseDirectives: FParser<Array<DirectiveNode>> = (p) => {
  const directives = [];
  while (p.peek(TokenKind.AT)) {
    directives.push(parseDirective(p));
  }
  return directives;
};

const parseDescription: FParser<Maybe<StringValueNode>> = (p) =>
  peekDescription(p) ? parseStringLiteral(p) : undefined;

const parseTypeDefinition: FParser<TypeDefinitionNode> = (
  parser,
): TypeDefinitionNode => {
  const start = parser.lookAhead();
  const description = parseDescription(parser);
  parser.keyword('data');
  const name = parseName(parser);
  const directives = parseDirectives(parser);
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
  const equal = parser.token(TokenKind.EQUALS);
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
      parser.fail('Variant');
      return [];
  }
};

const parseVariantDefinition = (
  parser: Parser,
  typeName?: NameNode,
): VariantDefinitionNode => {
  const start = parser.lookAhead();
  const description = parseDescription(parser);
  const name = typeName ?? parseVariantName(parser);
  const directives = parseDirectives(parser);
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

const parseVariantName: FParser<NameNode> = (p) => {
  const { value } = p.lookAhead();
  if (value === 'true' || value === 'false' || value === 'null') {
    p.fail('is reserved and cannot be used for an enum value');
  }
  return parseName(p);
};

const parseFieldsDefinition: FParser<
  Maybe<ReadonlyArray<FieldDefinitionNode>>
> = (parser) => {
  const nodes = [];
  if (parser.token(TokenKind.BRACE_L)) {
    while (!parser.token(TokenKind.BRACE_R)) {
      nodes.push(parseFieldDefinition(parser));
    }
    return nodes;
  }
  return undefined;
};

const parseTypeReference: FParser<TypeNode> = (parser) => {
  const start = parser._lexer.token;
  let type;
  if (parser.token(TokenKind.BRACKET_L)) {
    const innerType = parseTypeReference(parser);
    parser.expectToken(TokenKind.BRACKET_R);
    type = parser.node<ListTypeNode>(start, {
      kind: IrisKind.LIST_TYPE,
      type: innerType,
    });
  } else {
    type = parser.node<NamedTypeNode>(parser._lexer.token, {
      kind: IrisKind.NAMED_TYPE,
      name: parseName(parser),
    });
  }

  if (parser.token(TokenKind.QUESTION_MARK)) {
    return parser.node<MaybeTypeNode>(start, {
      kind: IrisKind.MAYBE_TYPE,
      type,
    });
  }

  return type;
};

const parseFieldDefinition: FParser<FieldDefinitionNode> = (parser) => {
  const start = parser.lookAhead();
  const description = parseDescription(parser);
  const name = parseName(parser);
  parser.expectToken(TokenKind.COLON);
  const type = parseTypeReference(parser);
  const directives = parseDirectives(parser);
  return parser.node<FieldDefinitionNode>(start, {
    kind: IrisKind.FIELD_DEFINITION,
    description,
    name,
    type,
    directives,
  });
};

const parseValue = (source: string): ValueNode => {
  const parser = new Parser(source);
  parser.expectToken(TokenKind.SOF);
  const value = parseValueLiteral(parser);
  parser.expectToken(TokenKind.EOF);
  return value;
};

const parseType = (source: string): TypeNode => {
  const parser = new Parser(source);
  parser.expectToken(TokenKind.SOF);
  const type = parseTypeReference(parser);
  parser.expectToken(TokenKind.EOF);
  return type;
};

export { parse, parseType, parseValue };
