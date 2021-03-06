import type { ParseOptions } from 'graphql';
import { Kind, Location, Source } from 'graphql';

import type { IrisError } from '../error';
import { syntaxError } from '../error';
import type {
  ArgumentDefinitionNode,
  ArgumentNode,
  BooleanValueNode,
  ConstArgumentNode,
  ConstDirectiveNode,
  ConstListValueNode,
  ConstObjectFieldNode,
  ConstObjectValueNode,
  ConstValueNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  EnumValueNode,
  FloatValueNode,
  IntValueNode,
  ListTypeNode,
  ListValueNode,
  MaybeTypeNode,
  NamedTypeNode,
  NameNode,
  NullValueNode,
  ObjectFieldNode,
  ObjectValueNode,
  StringValueNode,
  Token,
  TypeNode,
  ValueNode,
  VariableNode,
} from '../types/ast';
import { IrisDirectiveLocation } from '../types/directiveLocation';
import { IrisKind, TokenKind } from '../types/kinds';
import { instanceOf } from '../utils/legacy';
import type { Maybe } from '../utils/type-level';

import { isPunctuatorTokenKind, Lexer } from './lexer';

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws IrisError if a syntax error is encountered.
 */

/**
 * Given a string containing a GraphQL value (ex. `[42]`), parse the AST for
 * that value.
 * Throws IrisError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 */
export function parseValue(
  source: string | Source,
  options?: ParseOptions,
): ValueNode {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const value = parser.parseValueLiteral(false);
  parser.expectToken(TokenKind.EOF);
  return value;
}

/**
 * Similar to parseValue(), but raises a parse error if it encounters a
 * variable. The return type will be a constant value.
 */
export function parseConstValue(
  source: string | Source,
  options?: ParseOptions,
): ConstValueNode {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const value = parser.parseConstValueLiteral();
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
export function parseType(
  source: string | Source,
  options?: ParseOptions,
): TypeNode {
  const parser = new Parser(source, options);
  parser.expectToken(TokenKind.SOF);
  const type = parser.parseTypeReference();
  parser.expectToken(TokenKind.EOF);
  return type;
}

export function isSource(source: unknown): source is Source {
  return instanceOf(source, Source);
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
export class Parser {
  _lexer: Lexer;

  protected _options: Maybe<ParseOptions>;

  constructor(source: string | Source, options?: ParseOptions) {
    const sourceObj = isSource(source) ? source : new Source(source);

    this._lexer = new Lexer(sourceObj);
    this._options = options;
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

  /**
   * Variable : $ Name
   */
  parseVariable(): VariableNode {
    const start = this._lexer.token;
    this.expectToken(TokenKind.DOLLAR);
    return this.node<VariableNode>(start, {
      kind: Kind.VARIABLE,
      name: this.parseName(),
    });
  }

  /**
   * Arguments[Const] : ( Argument[?Const]+ )
   */
  parseArguments(isConst: true): Array<ConstArgumentNode>;
  parseArguments(isConst: boolean): Array<ArgumentNode>;
  parseArguments(isConst: boolean): Array<ArgumentNode> {
    const item = isConst ? this.parseConstArgument : this.parseArgument;
    return this.optionalMany(TokenKind.PAREN_L, item, TokenKind.PAREN_R);
  }

  /**
   * Argument[Const] : Name : Value[?Const]
   */
  parseArgument(isConst: true): ConstArgumentNode;
  parseArgument(isConst?: boolean): ArgumentNode;
  parseArgument(isConst: boolean = false): ArgumentNode {
    const start = this._lexer.token;
    const name = this.parseName();

    this.expectToken(TokenKind.COLON);
    return this.node<ArgumentNode>(start, {
      kind: Kind.ARGUMENT,
      name,
      value: this.parseValueLiteral(isConst),
    });
  }

  parseConstArgument(): ConstArgumentNode {
    return this.parseArgument(true);
  }

  // Implements the parsing rules in the Values section.

  /**
   * Value[Const] :
   *   - [~Const] Variable
   *   - IntValue
   *   - FloatValue
   *   - StringValue
   *   - BooleanValue
   *   - NullValue
   *   - EnumValue
   *   - ListValue[?Const]
   *   - ObjectValue[?Const]
   *
   * BooleanValue : one of `true` `false`
   *
   * NullValue : `null`
   *
   * EnumValue : Name but not `true`, `false` or `null`
   */
  parseValueLiteral(isConst: true): ConstValueNode;
  parseValueLiteral(isConst: boolean): ValueNode;
  parseValueLiteral(isConst: boolean): ValueNode {
    const token = this._lexer.token;
    switch (token.kind) {
      case TokenKind.BRACKET_L:
        return this.parseList(isConst);
      case TokenKind.BRACE_L:
        return this.parseObject(isConst);
      case TokenKind.INT:
        this._lexer.advance();
        return this.node<IntValueNode>(token, {
          kind: Kind.INT,
          value: token.value,
        });
      case TokenKind.FLOAT:
        this._lexer.advance();
        return this.node<FloatValueNode>(token, {
          kind: Kind.FLOAT,
          value: token.value,
        });
      case TokenKind.STRING:
      case TokenKind.BLOCK_STRING:
        return this.parseStringLiteral();
      case TokenKind.NAME:
        this._lexer.advance();
        switch (token.value) {
          case 'true':
            return this.node<BooleanValueNode>(token, {
              kind: Kind.BOOLEAN,
              value: true,
            });
          case 'false':
            return this.node<BooleanValueNode>(token, {
              kind: Kind.BOOLEAN,
              value: false,
            });
          case 'null':
            return this.node<NullValueNode>(token, { kind: Kind.NULL });
          default:
            return this.node<EnumValueNode>(token, {
              kind: Kind.ENUM,
              value: token.value,
            });
        }
      case TokenKind.DOLLAR:
        if (isConst) {
          this.expectToken(TokenKind.DOLLAR);
          if (this._lexer.token.kind === TokenKind.NAME) {
            const varName = this._lexer.token.value;
            throw syntaxError(
              this._lexer.source,
              token.start,
              `Unexpected variable "$${varName}" in constant value.`,
            );
          } else {
            throw this.unexpected(token);
          }
        }
        return this.parseVariable();
      default:
        throw this.unexpected();
    }
  }

  parseConstValueLiteral(): ConstValueNode {
    return this.parseValueLiteral(true);
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
   * ListValue[Const] :
   *   - [ ]
   *   - [ Value[?Const]+ ]
   */
  parseList(isConst: true): ConstListValueNode;
  parseList(isConst: boolean): ListValueNode;
  parseList(isConst: boolean): ListValueNode {
    const item = () => this.parseValueLiteral(isConst);
    return this.node<ListValueNode>(this._lexer.token, {
      kind: Kind.LIST,
      values: this.any(TokenKind.BRACKET_L, item, TokenKind.BRACKET_R),
    });
  }

  /**
   * ```
   * ObjectValue[Const] :
   *   - { }
   *   - { ObjectField[?Const]+ }
   * ```
   */
  parseObject(isConst: true): ConstObjectValueNode;
  parseObject(isConst: boolean): ObjectValueNode;
  parseObject(isConst: boolean): ObjectValueNode {
    const item = () => this.parseObjectField(isConst);
    return this.node<ObjectValueNode>(this._lexer.token, {
      kind: Kind.OBJECT,
      fields: this.any(TokenKind.BRACE_L, item, TokenKind.BRACE_R),
    });
  }

  /**
   * ObjectField[Const] : Name : Value[?Const]
   */
  parseObjectField(isConst: true): ConstObjectFieldNode;
  parseObjectField(isConst: boolean): ObjectFieldNode;
  parseObjectField(isConst: boolean): ObjectFieldNode {
    const start = this._lexer.token;
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    return this.node<ObjectFieldNode>(start, {
      kind: Kind.OBJECT_FIELD,
      name,
      value: this.parseValueLiteral(isConst),
    });
  }

  // Implements the parsing rules in the Directives section.

  /**
   * Directives[Const] : Directive[?Const]+
   */
  parseDirectives(isConst: true): Array<ConstDirectiveNode>;
  parseDirectives(isConst: boolean): Array<DirectiveNode>;
  parseDirectives(isConst: boolean): Array<DirectiveNode> {
    const directives = [];
    while (this.peek(TokenKind.AT)) {
      directives.push(this.parseDirective(isConst));
    }
    return directives;
  }

  parseConstDirectives(): Array<ConstDirectiveNode> {
    return this.parseDirectives(true);
  }

  /**
   * ```
   * Directive[Const] : @ Name Arguments[?Const]?
   * ```
   */
  parseDirective(isConst: true): ConstDirectiveNode;
  parseDirective(isConst: boolean): DirectiveNode;
  parseDirective(isConst: boolean): DirectiveNode {
    const start = this._lexer.token;
    this.expectToken(TokenKind.AT);
    return this.node<DirectiveNode>(start, {
      kind: Kind.DIRECTIVE,
      name: this.parseName(),
      arguments: this.parseArguments(isConst),
    });
  }

  // Implements the parsing rules in the Types section.

  /**
   * Type :
   *   - NamedType
   *   - ListType
   *   - NonNullType
   */
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
      type = this.parseNamedType();
    }

    if (this.expectOptionalToken(TokenKind.QUESTION_MARK)) {
      return this.node<MaybeTypeNode>(start, {
        kind: IrisKind.MAYBE_TYPE,
        type,
      });
    }

    return type;
  }

  /**
   * NamedType : Name
   */
  parseNamedType(): NamedTypeNode {
    return this.node<NamedTypeNode>(this._lexer.token, {
      kind: IrisKind.NAMED_TYPE,
      name: this.parseName(),
    });
  }

  // Implements the parsing rules in the Type Definition section.

  peekDescription(): boolean {
    return this.peek(TokenKind.STRING) || this.peek(TokenKind.BLOCK_STRING);
  }

  /**
   * Description : StringValue
   */
  parseDescription(): undefined | StringValueNode {
    if (this.peekDescription()) {
      return this.parseStringLiteral();
    }
  }

  parseArgumentDefs(): Array<ArgumentDefinitionNode> {
    return this.optionalMany(
      TokenKind.PAREN_L,
      this.parseInputValueDef,
      TokenKind.PAREN_R,
    );
  }

  /**
   * InputValueDefinition :
   *   - Description? Name : Type DefaultValue? Directives[Const]?
   */
  parseInputValueDef(): ArgumentDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    const name = this.parseName();
    this.expectToken(TokenKind.COLON);
    const type = this.parseTypeReference();
    let defaultValue;
    if (this.expectOptionalToken(TokenKind.EQUALS)) {
      defaultValue = this.parseConstValueLiteral();
    }
    const directives = this.parseConstDirectives();
    return this.node<ArgumentDefinitionNode>(start, {
      kind: IrisKind.ARGUMENT_DEFINITION,
      description,
      name,
      type,
      defaultValue,
      directives,
    });
  }

  /**
   * ```
   * DirectiveDefinition :
   *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
   * ```
   */
  parseDirectiveDefinition(): DirectiveDefinitionNode {
    const start = this._lexer.token;
    const description = this.parseDescription();
    this.expectKeyword('directive');
    this.expectToken(TokenKind.AT);
    const name = this.parseName();
    const args = this.parseArgumentDefs();
    const repeatable = this.expectOptionalKeyword('repeatable');
    this.expectKeyword('on');
    const locations = this.parseDirectiveLocations();
    return this.node<DirectiveDefinitionNode>(start, {
      kind: IrisKind.DIRECTIVE_DEFINITION,
      description,
      name,
      arguments: args,
      repeatable,
      locations,
    });
  }

  /**
   * DirectiveLocations :
   *   - `|`? DirectiveLocation
   *   - DirectiveLocations | DirectiveLocation
   */
  parseDirectiveLocations(): Array<NameNode> {
    return this.delimitedMany(TokenKind.PIPE, this.parseDirectiveLocation);
  }

  /*
   * DirectiveLocation :
   *   - ExecutableDirectiveLocation
   *   - TypeSystemDirectiveLocation
   *
   * ExecutableDirectiveLocation : one of
   *   `QUERY`
   *   `MUTATION`
   *   `SUBSCRIPTION`
   *   `FIELD`
   *   `FRAGMENT_DEFINITION`
   *   `FRAGMENT_SPREAD`
   *   `INLINE_FRAGMENT`
   *
   * TypeSystemDirectiveLocation : one of
   *   `FIELD_DEFINITION`
   *   `ARGUMENT_DEFINITION`
   *   `UNION`
   *   `ENUM`
   *   `ENUM_VALUE`
   *   `INPUT_OBJECT`
   *   `INPUT_FIELD_DEFINITION`
   */
  parseDirectiveLocation(): NameNode {
    const start = this._lexer.token;
    const name = this.parseName();

    if (
      Object.prototype.hasOwnProperty.call(IrisDirectiveLocation, name.value)
    ) {
      return name;
    }
    throw this.unexpected(start);
  }

  // Core parsing utility functions

  /**
   * Returns a node that, if configured to do so, sets a "loc" field as a
   * location object, used to identify the place in the source that created a
   * given parsed object.
   */
  node<T extends { loc?: Location }>(startToken: Token, node: T): T {
    if (this._options?.noLocation !== true) {
      node.loc = new Location(
        startToken,
        this._lexer.lastToken,
        this._lexer.source,
      );
    }
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
