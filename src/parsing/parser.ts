import type { IrisError } from '../error';
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
  Token,
  TypeDefinitionNode,
  TypeNode,
  ValueNode,
  VariantDefinitionNode,
} from '../types/ast';
import { Location } from '../types/ast';
import { GQLKind as Kind, IrisKind, TokenKind } from '../types/kinds';
import type { Maybe } from '../utils/type-level';

import { isPunctuatorTokenKind, Lexer } from './lexer';
import { Source } from './source';

function parseValue(source: string): ValueNode {
  const parser = new Parser(source);
  parser.expectToken(TokenKind.SOF);
  const value = parser.parseValueLiteral();
  parser.expectToken(TokenKind.EOF);
  return value;
}

/**
 * Given a string containing a GraphQL Type (ex. `[Int!]`), parse the AST for
 * that type.
 * Throws IrisError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Types directly and
 * in isolation of complete GraphQL documents.
 *
 * Consider providing the results to the utility function: typeFromAST().
 */
function parseType(source: string): TypeNode {
  const parser = new Parser(source);
  parser.expectToken(TokenKind.SOF);
  const type = parser.parseTypeReference();
  parser.expectToken(TokenKind.EOF);
  return type;
}

/**
 * This class is exported only to assist people in implementing their own parsers
 * without duplicating too much code and should be used only as last resort for cases
 * such as experimental syntax or if certain features could not be contributed upstream.
 *
 * It is still part of the internal API and is versioned, so any changes to it are never
 * considered breaking changes. If you still need to support multiple versions of the
 * library, please use the `versionInfo` variable for version detection.
 *
 * @internal
 */
class Parser {
  _lexer: Lexer;

  constructor(source: string) {
    this._lexer = new Lexer(new Source(source));
  }

  /**
   * Converts a name lex token into a name parse node.
   */
  parseName(): NameNode {
    const token = this.expectToken(TokenKind.NAME);

    if (token.value.startsWith('__')) {
      throw syntaxError(
        this._lexer.source,
        this._lexer.token.start,
        `Name "${token.value}" must not begin with "__", which is reserved by GraphQL introspection.`,
      );
    }

    return this.node<NameNode>(token, {
      kind: Kind.NAME,
      value: token.value,
    });
  }

  // Implements the parsing rules in the Document section.

  invalidToken(message: string) {
    throw syntaxError(
      this._lexer.source,
      this._lexer.token.start,
      `${getTokenDesc(this._lexer.token)} ${message}.`,
    );
  }

  parseArguments(): Array<ArgumentNode> {
    const item = this.parseArgument;
    return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
  }

  parseArgument(): ArgumentNode {
    const start = this._lexer.token;
    const name = this.parseName();

    this.expectToken(TokenKind.COLON);
    return this.node<ArgumentNode>(start, {
      kind: Kind.ARGUMENT,
      name,
      value: this.parseValueLiteral(),
    });
  }

  parseValueLiteral(): ValueNode {
    const token = this._lexer.token;
    switch (token.kind) {
      case TokenKind.STRING:
      case TokenKind.BLOCK_STRING:
        return this.parseStringLiteral();
      case TokenKind.NAME:
        this._lexer.advance();
        switch (token.value) {
          case 'null':
            return this.node<NullValueNode>(token, { kind: Kind.NULL });
          default:
            throw this.unexpected();
        }
      default:
        throw this.unexpected();
    }
  }

  parseStringLiteral(): StringValueNode {
    const token = this._lexer.token;
    this._lexer.advance();
    return this.node<StringValueNode>(token, {
      kind: Kind.STRING,
      value: token.value,
      block: token.kind === TokenKind.BLOCK_STRING,
    });
  }

  /**
   * Directives[Const] : Directive[?Const]+
   */
  parseDirectives(): Array<DirectiveNode> {
    const directives = [];
    while (this.peek(TokenKind.AT)) {
      directives.push(this.parseDirective());
    }
    return directives;
  }

  /**
   * ```
   * Directive[Const] : @ Name Arguments[?Const]?
   * ```
   */
  parseDirective(): DirectiveNode {
    const start = this._lexer.token;
    this.expectToken(TokenKind.AT);
    return this.node<DirectiveNode>(start, {
      kind: Kind.DIRECTIVE,
      name: this.parseName(),
      arguments: this.parseArguments(),
    });
  }

  parseTypeReference(): TypeNode {
    const start = this._lexer.token;
    let type;
    if (this.expectOptionalToken(TokenKind.BRACKET_L)) {
      const innerType = this.parseTypeReference();
      this.expectToken(TokenKind.BRACKET_R);
      type = this.node<ListTypeNode>(start, {
        kind: IrisKind.LIST_TYPE,
        type: innerType,
      });
    } else {
      type = this.node<NamedTypeNode>(this._lexer.token, {
        kind: IrisKind.NAMED_TYPE,
        name: this.parseName(),
      });
    }

    if (this.expectOptionalToken(TokenKind.QUESTION_MARK)) {
      return this.node<MaybeTypeNode>(start, {
        kind: IrisKind.MAYBE_TYPE,
        type,
      });
    }

    return type;
  }

  peekDescription(): boolean {
    return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
  }

  /**
   * Description : StringValue
   */
  parseDescription(): undefined | StringValueNode {
    return this.peekDescription() ? this.parseStringLiteral() : undefined;
  }

  // Core parsing utility functions

  /**
   * Returns a node that, if configured to do so, sets a "loc" field as a
   * location object, used to identify the place in the source that created a
   * given parsed object.
   */
  node<T extends { loc?: Location }>(startToken: Token, node: T): T {
    node.loc = new Location(
      startToken,
      this._lexer.lastToken,
      this._lexer.source,
    );
    return node;
  }

  /**
   * Determines if the next token is of a given kind
   */
  peek(kind: TokenKind): boolean {
    return this._lexer.token.kind === kind;
  }

  /**
   * If the next token is of the given kind, return that token after advancing the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectToken(kind: TokenKind): Token {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this._lexer.advance();
      return token;
    }

    return this.throwExpected(getTokenKindDesc(kind));
  }

  throwExpected(kind: string): Token {
    const token = this._lexer.token;
    throw syntaxError(
      this._lexer.source,
      token.start,
      `Expected ${kind}, found ${getTokenDesc(token)}.`,
    );
  }

  /**
   * If the next token is of the given kind, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalToken(kind: TokenKind): boolean {
    const token = this._lexer.token;
    if (token.kind === kind) {
      this._lexer.advance();
      return true;
    }
    return false;
  }

  lookAhead(): Token {
    return this._lexer.token;
  }

  /**
   * If the next token is a given keyword, advance the lexer.
   * Otherwise, do not change the parser state and throw an error.
   */
  expectKeyword(value: string): void {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this._lexer.advance();
    } else {
      throw syntaxError(
        this._lexer.source,
        token.start,
        `Expected "${value}", found ${getTokenDesc(token)}.`,
      );
    }
  }

  /**
   * If the next token is a given keyword, return "true" after advancing the lexer.
   * Otherwise, do not change the parser state and return "false".
   */
  expectOptionalKeyword(value: string): boolean {
    const token = this._lexer.token;
    if (token.kind === TokenKind.NAME && token.value === value) {
      this._lexer.advance();
      return true;
    }
    return false;
  }

  /**
   * Helper function for creating an error when an unexpected lexed token is encountered.
   */
  unexpected(atToken?: Maybe<Token>): IrisError {
    const token = atToken ?? this._lexer.token;
    return syntaxError(
      this._lexer.source,
      token.start,
      `Unexpected ${getTokenDesc(token)}.`,
    );
  }

  /**
   * Returns a possibly empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  any<T>(
    openKind: TokenKind,
    parseFn: () => T,
    closeKind: TokenKind,
  ): Array<T> {
    this.expectToken(openKind);
    const nodes = [];
    while (!this.expectOptionalToken(closeKind)) {
      nodes.push(parseFn.call(this));
    }
    return nodes;
  }

  /**
   * Returns a list of parse nodes, determined by the parseFn.
   * It can be empty only if open token is missing otherwise it will always return non-empty list
   * that begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  optionalMany<T>(
    openKind: TokenKind,
    parseFn: () => T,
    closeKind: TokenKind,
  ): Array<T> {
    if (this.expectOptionalToken(openKind)) {
      const nodes = [];
      do {
        nodes.push(parseFn.call(this));
      } while (!this.expectOptionalToken(closeKind));
      return nodes;
    }
    return [];
  }

  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list begins with a lex token of openKind and ends with a lex token of closeKind.
   * Advances the parser to the next lex token after the closing token.
   */
  many<T>(
    openKind: TokenKind,
    parseFn: () => T,
    closeKind: TokenKind,
  ): Array<T> {
    this.expectToken(openKind);
    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (!this.expectOptionalToken(closeKind));
    return nodes;
  }

  /**
   * Returns a non-empty list of parse nodes, determined by the parseFn.
   * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
   * Advances the parser to the next lex token after last item in the list.
   */
  delimitedMany<T>(delimiterKind: TokenKind, parseFn: () => T): Array<T> {
    this.expectOptionalToken(delimiterKind);

    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (this.expectOptionalToken(delimiterKind));
    return nodes;
  }
}

/**
 * A helper function to describe a token as a string for debugging.
 */
function getTokenDesc(token: Token): string {
  const value = token.value;
  return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : '');
}

/**
 * A helper function to describe a token kind as a string for debugging.
 */
function getTokenKindDesc(kind: TokenKind): string {
  return isPunctuatorTokenKind(kind) ? `"${kind}"` : kind;
}

const parse = (source: string): DocumentNode =>
  parseDocument(new Parser(source));

type FParser<T> = (parser: Parser) => T;

const parseDocument: FParser<DocumentNode> = (parser) =>
  parser.node<DocumentNode>(parser._lexer.token, {
    kind: IrisKind.DOCUMENT,
    definitions: parser.many(
      TokenKind.SOF,
      () => parseDefinition(parser),
      TokenKind.EOF,
    ),
  });

const parseDefinition: FParser<TypeDefinitionNode> = (parser) => {
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

const parseTypeDefinition = (parser: Parser): TypeDefinitionNode => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword('data');
  const name = parser.parseName();
  const directives = parser.parseDirectives();
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
  const directives = parser.parseDirectives();
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
  const directives = parser.parseDirectives();
  return parser.node<FieldDefinitionNode>(start, {
    kind: IrisKind.FIELD_DEFINITION,
    description,
    name,
    type,
    directives,
  });
};

export { parse, parseType, parseValue };
