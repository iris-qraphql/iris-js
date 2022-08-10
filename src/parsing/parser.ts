import type { IrisError } from '../error';
import { syntaxError } from '../error';
import type { Token } from '../types/ast';
import { Location } from '../types/ast';
import { TokenKind } from '../types/kinds';
import type { Maybe } from '../utils/type-level';

import { isPunctuatorTokenKind, Lexer } from './lexer';
import { Source } from './source';

export class Parser {
  _lexer: Lexer;

  constructor(source: string) {
    this._lexer = new Lexer(new Source(source));
  }

  node<T extends { loc?: Location }>(startToken: Token, node: T): T {
    node.loc = new Location(
      startToken,
      this._lexer.lastToken,
      this._lexer.source,
    );
    return node;
  }

  peek = (kind: TokenKind): boolean => this._lexer.token.kind === kind;

  lookAhead = (): Token => this._lexer.token;

  fail<T>(kind: string): T {
    const token = this._lexer.token;
    throw syntaxError(
      this._lexer.source,
      token.start,
      `Expected ${kind}, found ${getTokenDesc(token)}.`,
    );
  }

  expectToken(kind: TokenKind): Token {
    const token = this.token(kind);
    return token ? token : this.fail(getTokenKindDesc(kind));
  }

  token(kind: TokenKind): Maybe<Token> {
    const token = this._lexer.token;

    if (token.kind !== kind) {
      return undefined;
    }

    this._lexer.advance();
    return token;
  }

  keyword(value: string): void {
    const token = this.lookAhead();

    if (token.kind === TokenKind.NAME && token.value === value) {
      this._lexer.advance();
    } else {
      this.fail(value);
    }
  }

  unexpected(atToken?: Maybe<Token>): IrisError {
    const token = atToken ?? this._lexer.token;
    return syntaxError(
      this._lexer.source,
      token.start,
      `Unexpected ${getTokenDesc(token)}.`,
    );
  }

  manyTill = <T>(f: () => T, closeKind: TokenKind): Array<T> => {
    const nodes = [];
    do {
      nodes.push(f.call(this));
    } while (!this.token(closeKind));
    return nodes;
  };

  many<T>(
    openKind: TokenKind,
    f: () => T,
    closeKind: TokenKind,
  ): ReadonlyArray<T> {
    this.expectToken(openKind);
    return this.manyTill(f, closeKind);
  }

  delimitedMany<T>(delimiterKind: TokenKind, parseFn: () => T): Array<T> {
    this.token(delimiterKind);

    const nodes = [];
    do {
      nodes.push(parseFn.call(this));
    } while (this.token(delimiterKind));
    return nodes;
  }
}

const getTokenDesc = (token: Token): string =>
  getTokenKindDesc(token.kind) +
  (token.value != null ? ` "${token.value}"` : '');

const getTokenKindDesc = (kind: TokenKind): string =>
  isPunctuatorTokenKind(kind) ? `"${kind}"` : kind;

export type FParser<T> = (parser: Parser) => T;
