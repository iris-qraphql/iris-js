import { syntaxError } from '../error';
import { Location, Token } from '../types/ast';
import { TokenKind } from '../types/kinds';
import { optional } from '../utils/type-level';

import { isPunctuatorTokenKind, Lexer } from './lexer';
import { Source } from './source';

type FailOptions = {
  expected?: InspectValue;
  unexpected?: Token;
};
export class Parser {
  _lexer: Lexer;

  constructor(source: string) {
    this._lexer = new Lexer(new Source(source));
  }

  node = <T extends { loc?: Location }>(startToken: Token, node: T): T => ({
    ...node,
    loc: new Location(startToken, this._lexer.lastToken, this._lexer.source),
  });

  peek = (kind: TokenKind): boolean => this._lexer.token.kind === kind;

  lookAhead = (): Token => this._lexer.token;

  fail = <T>(options: FailOptions = {}): T => {
    const token = options.unexpected ?? this.lookAhead();
    throw syntaxError(
      this._lexer.source,
      token.start,
      options.expected
        ? `Expected ${inspect(options.expected)}, found ${inspect(token)}.`
        : `Unexpected ${inspect(token)}.`,
    );
  };

  satisfy = (f: (t: Token) => boolean, expected: InspectValue): Token => {
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

  manyTill = <T>(f: () => T, closeKind: TokenKind): Array<T> => {
    const nodes = [];
    do {
      nodes.push(f.call(this));
    } while (!optional(this.token, closeKind));
    return nodes;
  };

  many<T>(
    openKind: TokenKind,
    f: () => T,
    closeKind: TokenKind,
  ): ReadonlyArray<T> {
    this.token(openKind);
    return this.manyTill(f, closeKind);
  }

  separatedBy = <T>(delimiter: TokenKind, f: () => T): Array<T> => {
    const nodes = [];
    do {
      nodes.push(f.call(this));
    } while (optional(this.token, delimiter));
    return nodes;
  };
}

type InspectValue = Token | TokenKind | string;

const inspect = (input: InspectValue): string => {
  if (input instanceof Token) {
    return (
      inspect(input.kind) + (input.value != null ? ` "${input.value}"` : '')
    );
  }
  return isPunctuatorTokenKind(input as TokenKind) ? `"${input}"` : input;
};

export type FParser<T> = (parser: Parser) => T;
