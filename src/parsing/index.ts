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
  parser.node<DocumentNode>(parser.lookAhead(), {
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

  throw parser.fail({ unexpected: keywordToken });
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
  const token = p.token(TokenKind.NAME);

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
  const token = p.lookAhead();
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
          throw p.fail();
      }
    default:
      throw p.fail();
  }
};
const parseStringLiteral: FParser<StringValueNode> = (p) => {
  const token = p.lookAhead();
  p._lexer.advance();
  return p.node<StringValueNode>(token, {
    kind: Kind.STRING,
    value: token.value,
    block: token.kind === TokenKind.BLOCK_STRING,
  });
};

const parseArgument: FParser<ArgumentNode> = (p) => {
  const start = p.lookAhead();
  const name = parseName(p);

  p.token(TokenKind.COLON);
  return p.node<ArgumentNode>(start, {
    kind: Kind.ARGUMENT,
    name,
    value: parseValueLiteral(p),
  });
};

const parseArguments: FParser<ReadonlyArray<ArgumentNode>> = (p) =>
  p.optional(
    () => p.many(TokenKind.PAREN_L, () => parseArgument(p), TokenKind.PAREN_R),
    undefined,
  ) ?? [];

const parseDirective: FParser<DirectiveNode> = (p) => {
  const start = p.lookAhead();
  p.token(TokenKind.AT);
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
  p: Parser,
): ReadonlyArray<VariantDefinitionNode> => {
  const equal = p.optional(p.token, TokenKind.EQUALS);
  if (!equal) {
    return [];
  }

  switch (p.lookAhead().kind) {
    case TokenKind.NAME:
      return p.separatedBy(TokenKind.PIPE, () => parseVariantDefinition(p));
    case TokenKind.BRACE_L:
      return [parseVariantDefinition(p, name)];
    default:
      p.fail({ expected: 'Variant' });
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
    p.fail({ expected: 'is reserved and cannot be used for an enum value' });
  }
  return parseName(p);
};

const parseFieldsDefinition: FParser<
  Maybe<ReadonlyArray<FieldDefinitionNode>>
> = (p) => {
  const nodes = [];
  if (p.optional(p.token, TokenKind.BRACE_L)) {
    while (!p.optional(p.token, TokenKind.BRACE_R)) {
      nodes.push(parseFieldDefinition(p));
    }
    return nodes;
  }
  return undefined;
};

const parseTypeReference: FParser<TypeNode> = (p) => {
  const start = p.lookAhead();
  let type;
  if (p.optional(p.token, TokenKind.BRACKET_L)) {
    const innerType = parseTypeReference(p);
    p.token(TokenKind.BRACKET_R);
    type = p.node<ListTypeNode>(start, {
      kind: IrisKind.LIST_TYPE,
      type: innerType,
    });
  } else {
    type = p.node<NamedTypeNode>(p.lookAhead(), {
      kind: IrisKind.NAMED_TYPE,
      name: parseName(p),
    });
  }

  if (p.optional(p.token, TokenKind.QUESTION_MARK)) {
    return p.node<MaybeTypeNode>(start, {
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
  parser.token(TokenKind.COLON);
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
  parser.token(TokenKind.SOF);
  const value = parseValueLiteral(parser);
  parser.token(TokenKind.EOF);
  return value;
};

const parseType = (source: string): TypeNode => {
  const parser = new Parser(source);
  parser.token(TokenKind.SOF);
  const type = parseTypeReference(parser);
  parser.token(TokenKind.EOF);
  return type;
};

export { parse, parseType, parseValue };
