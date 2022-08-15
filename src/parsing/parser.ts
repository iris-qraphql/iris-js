import type { Maybe } from 'graphql/jsutils/Maybe';

import { syntaxError } from '../error';
import { Location, Token } from '../types/ast';
import { TokenKind } from '../types/kinds';

import { isPunctuatorTokenKind, Lexer } from './lexer';
import { Source } from './source';

type FailOptions = {
  expected?: Value;
  unexpected?: Token;
};

export class Parser {
  _lexer: Lexer;

  constructor(source: string) {
    this._lexer = new Lexer(new Source(source));
  }

  optional = <I, O>(f: (i: I) => O, i: I): Maybe<O> => {
    const initial = this._lexer.token.start;
    try {
      return f(i);
    } catch (e) {
      if (initial === this._lexer.token.start) {
        return undefined;
      }
      throw e;
    }
  };

  node = <T extends { loc?: Location }>(startToken: Token, node: T): T => ({
    ...node,
    loc: new Location(startToken, this._lexer.lastToken, this._lexer.source),
  });

  peek = (kind: TokenKind): boolean => this._lexer.token.kind === kind;

  lookAhead = (): Token => this._lexer.token;

  fail = <T>({ unexpected, expected }: FailOptions = {}): T => {
    const token = unexpected ?? this.lookAhead();
    throw syntaxError(
      this._lexer.source,
      token.start,
      expected
        ? `Expected ${inspect(expected)}, found ${inspect(token)}.`
        : `Unexpected ${inspect(token)}.`,
    );
  };

  satisfy = (f: (t: Token) => boolean, expected: Value): Token => {
    const token = this.lookAhead();

    if (!f(token)) {
      return this.fail({ expected });
    }

    this._lexer.advance();
    return token;
  };

  token = (kind: TokenKind) =>
    this.satisfy((token) => token.kind === kind, kind);

  keyword = (value: string): void => {
    this.satisfy(
      (token) => token.kind === TokenKind.NAME && token.value === value,
      value,
    );
  };

  many = <T>(open: TokenKind, f: () => T, close: TokenKind): Array<T> => {
    this.token(open);

    const nodes = [];
    do {
      nodes.push(f.call(this));
    } while (!this.optional(this.token, close));
    return nodes;
  };

  separatedBy = <T>(separator: TokenKind, f: () => T): Array<T> => {
    const nodes = [];
    do {
      nodes.push(f.call(this));
    } while (this.optional(this.token, separator));
    return nodes;
  };
}

type Value = Token | TokenKind | string;

const inspect = (input: Value): string => {
  if (input instanceof Token) {
    return (
      inspect(input.kind) + (input.value != null ? ` "${input.value}"` : '')
    );
  }
  return isPunctuatorTokenKind(input as TokenKind) ? `"${input}"` : input;
};

export type FParser<T> = (parser: Parser) => T;
