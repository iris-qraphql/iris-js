import { isPunctuatorTokenKind, Lexer } from '../lexer';
import { Source } from '../source';

function lexOne(str: string) {
  const lexer = new Lexer(new Source(str));
  return { ...lexer.advance() };
}

describe('isPunctuatorTokenKind', () => {
  const isPunctuatorToken = (text: string) =>
    isPunctuatorTokenKind(lexOne(text).kind);

  it('returns true for punctuator tokens', () => {
    expect(isPunctuatorToken('?')).toEqual(true);
    expect(isPunctuatorToken('$')).toEqual(true);
    expect(isPunctuatorToken('&')).toEqual(true);
    expect(isPunctuatorToken('(')).toEqual(true);
    expect(isPunctuatorToken(')')).toEqual(true);
    expect(isPunctuatorToken('...')).toEqual(true);
    expect(isPunctuatorToken(':')).toEqual(true);
    expect(isPunctuatorToken('=')).toEqual(true);
    expect(isPunctuatorToken('@')).toEqual(true);
    expect(isPunctuatorToken('[')).toEqual(true);
    expect(isPunctuatorToken(']')).toEqual(true);
    expect(isPunctuatorToken('{')).toEqual(true);
    expect(isPunctuatorToken('|')).toEqual(true);
    expect(isPunctuatorToken('}')).toEqual(true);
  });

  it('returns false for non-punctuator tokens', () => {
    expect(isPunctuatorToken('')).toEqual(false);
    expect(isPunctuatorToken('name')).toEqual(false);
    expect(isPunctuatorToken('1')).toEqual(false);
    expect(isPunctuatorToken('3.14')).toEqual(false);
    expect(isPunctuatorToken('"str"')).toEqual(false);
    expect(isPunctuatorToken('"""str"""')).toEqual(false);
  });
});
