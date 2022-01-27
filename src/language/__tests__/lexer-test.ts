import { dedent } from '../../__testUtils__/dedent';

import { inspect } from '../../jsutils/inspect';

import { toJSONDeep } from '../../utils/toJSONDeep';

import type { Token } from '../ast';
import { isPunctuatorTokenKind, Lexer } from '../lexer';
import { Source } from '../source';
import { TokenKind } from '../tokenKind';

export function expectToThrowJSON(fn: () => unknown) {
  function mapException(): unknown {
    try {
      return fn();
    } catch (error) {
      return toJSONDeep(error);
    }
  }

  return expect(mapException());
}

function lexOne(str: string) {
  const lexer = new Lexer(new Source(str));
  return { ...lexer.advance() };
}

function lexSecond(str: string) {
  const lexer = new Lexer(new Source(str));
  lexer.advance();
  return lexer.advance();
}

function expectSyntaxError(text: string) {
  return expectToThrowJSON(() => lexSecond(text));
}

describe('Lexer', () => {
  it('ignores BOM header', () => {
    expect(lexOne('\uFEFF foo')).toMatchSnapshot();
  });

  it('tracks line breaks', () => {
    expect(lexOne('foo')).toMatchSnapshot();
    expect(lexOne('\nfoo')).toMatchSnapshot();
    expect(lexOne('\rfoo')).toMatchSnapshot();
    expect(lexOne('\r\nfoo')).toMatchSnapshot();
    expect(lexOne('\n\rfoo')).toMatchSnapshot();
    expect(lexOne('\r\r\n\nfoo')).toMatchSnapshot();
    expect(lexOne('\n\n\r\rfoo')).toMatchSnapshot();
  });

  it('records line and column', () => {
    expect(lexOne('\n \r\n \r  foo\n')).toMatchSnapshot();
  });

  it('can be Object.toStringified, JSON.stringified, or jsutils.inspected', () => {
    const lexer = new Lexer(new Source('foo'));
    const token = lexer.advance();

    expect(Object.prototype.toString.call(lexer)).toEqual('[object Lexer]');

    expect(Object.prototype.toString.call(token)).toEqual('[object Token]');
    expect(JSON.stringify(token)).toEqual(
      '{"kind":"Name","value":"foo","line":1,"column":1}',
    );
    expect(inspect(token)).toEqual(
      '{ kind: "Name", value: "foo", line: 1, column: 1 }',
    );
  });

  it('skips whitespace and comments', () => {
    expect(
      lexOne(`

    foo


`),
    ).toMatchSnapshot();

    expect(lexOne('\t\tfoo\t\t')).toMatchSnapshot();

    expect(
      lexOne(`
    #comment
    foo#comment
`),
    ).toMatchSnapshot();

    expect(lexOne(',,,foo,,,')).toMatchSnapshot();
  });

  it('errors respect whitespace', () => {
    let caughtError;
    try {
      lexOne(['', '', ' ~', ''].join('\n'));
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).toEqual(dedent`
      Syntax Error: Unexpected character: "~".

      GraphQL request:3:2
      2 |
      3 |  ~
        |  ^
      4 |
    `);
  });

  it('updates line numbers in error for file context', () => {
    let caughtError;
    try {
      const str = ['', '', '     ~', ''].join('\n');
      const source = new Source(str, 'foo.js', { line: 11, column: 12 });
      new Lexer(source).advance();
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).toEqual(dedent`
      Syntax Error: Unexpected character: "~".

      foo.js:13:6
      12 |
      13 |      ~
         |      ^
      14 |
    `);
  });

  it('updates column numbers in error for file context', () => {
    let caughtError;
    try {
      const source = new Source('~', 'foo.js', { line: 1, column: 5 });
      new Lexer(source).advance();
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).toEqual(dedent`
      Syntax Error: Unexpected character: "~".

      foo.js:1:5
      1 |     ~
        |     ^
    `);
  });

  it('lexes strings', () => {
    expect(lexOne('""')).toMatchSnapshot();
    expect(lexOne('"simple"')).toMatchSnapshot();
    expect(lexOne('" white space "')).toMatchSnapshot();
    expect(lexOne('"quote \\""')).toMatchSnapshot();
    expect(lexOne('"escaped \\n\\r\\b\\t\\f"')).toMatchSnapshot();
    expect(lexOne('"slashes \\\\ \\/"')).toMatchSnapshot();
    expect(
      lexOne('"unescaped unicode outside BMP \u{1f600}"'),
    ).toMatchSnapshot();

    expect(
      lexOne('"unescaped maximal unicode outside BMP \u{10ffff}"'),
    ).toMatchSnapshot();

    expect(lexOne('"unicode \\u1234\\u5678\\u90AB\\uCDEF"')).toMatchSnapshot();

    expect(
      lexOne('"unicode \\u{1234}\\u{5678}\\u{90AB}\\u{CDEF}"'),
    ).toMatchSnapshot();

    expect(
      lexOne('"string with unicode escape outside BMP \\u{1F600}"'),
    ).toMatchSnapshot();

    expect(
      lexOne('"string with minimal unicode escape \\u{0}"'),
    ).toMatchSnapshot();
    expect(
      lexOne('"string with maximal unicode escape \\u{10FFFF}"'),
    ).toMatchSnapshot();

    expect(
      lexOne('"string with maximal minimal unicode escape \\u{00000000}"'),
    ).toMatchSnapshot();

    expect(
      lexOne('"string with unicode surrogate pair escape \\uD83D\\uDE00"'),
    ).toMatchSnapshot();
    expect(
      lexOne('"string with minimal surrogate pair escape \\uD800\\uDC00"'),
    ).toMatchSnapshot();
    expect(
      lexOne('"string with maximal surrogate pair escape \\uDBFF\\uDFFF"'),
    ).toMatchSnapshot();
  });

  it('lex reports useful string errors', () => {
    expectSyntaxError('"').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 2 }],
    });

    expectSyntaxError('"""').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 4 }],
    });

    expectSyntaxError('""""').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 5 }],
    });

    expectSyntaxError('"no end quote').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 14 }],
    });

    expectSyntaxError("'single quotes'").toEqual({
      message:
        'Syntax Error: Unexpected single quote character (\'), did you mean to use a double quote (")?',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('"bad surrogate \uDEAD"').toEqual({
      message: 'Syntax Error: Invalid character within String: U+DEAD.',
      locations: [{ line: 1, column: 16 }],
    });

    expectSyntaxError('"bad high surrogate pair \uDEAD\uDEAD"').toEqual({
      message: 'Syntax Error: Invalid character within String: U+DEAD.',
      locations: [{ line: 1, column: 26 }],
    });

    expectSyntaxError('"bad low surrogate pair \uD800\uD800"').toEqual({
      message: 'Syntax Error: Invalid character within String: U+D800.',
      locations: [{ line: 1, column: 25 }],
    });

    expectSyntaxError('"multi\nline"').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 7 }],
    });

    expectSyntaxError('"multi\rline"').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 7 }],
    });

    expectSyntaxError('"bad \\z esc"').toEqual({
      message: 'Syntax Error: Invalid character escape sequence: "\\z".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\x esc"').toEqual({
      message: 'Syntax Error: Invalid character escape sequence: "\\x".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\u1 esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u1 es".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\u0XX1 esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u0XX1".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\uXXXX esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uXXXX".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\uFXXX esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uFXXX".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\uXXXF esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uXXXF".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\u{} esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{}".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\u{FXXX} esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{FX".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\u{FFFF esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{FFFF ".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"bad \\u{FFFF"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{FFFF"".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('"too high \\u{110000} esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{110000}".',
      locations: [{ line: 1, column: 11 }],
    });

    expectSyntaxError('"way too high \\u{12345678} esc"').toEqual({
      message:
        'Syntax Error: Invalid Unicode escape sequence: "\\u{12345678}".',
      locations: [{ line: 1, column: 15 }],
    });

    expectSyntaxError('"too long \\u{000000000} esc"').toEqual({
      message:
        'Syntax Error: Invalid Unicode escape sequence: "\\u{000000000".',
      locations: [{ line: 1, column: 11 }],
    });

    expectSyntaxError('"bad surrogate \\uDEAD esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uDEAD".',
      locations: [{ line: 1, column: 16 }],
    });

    expectSyntaxError('"bad surrogate \\u{DEAD} esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{DEAD}".',
      locations: [{ line: 1, column: 16 }],
    });

    expectSyntaxError(
      '"cannot use braces for surrogate pair \\u{D83D}\\u{DE00} esc"',
    ).toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\u{D83D}".',
      locations: [{ line: 1, column: 39 }],
    });

    expectSyntaxError('"bad high surrogate pair \\uDEAD\\uDEAD esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uDEAD".',
      locations: [{ line: 1, column: 26 }],
    });

    expectSyntaxError('"bad low surrogate pair \\uD800\\uD800 esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uD800".',
      locations: [{ line: 1, column: 25 }],
    });

    expectSyntaxError('"cannot escape half a pair \uD83D\\uDE00 esc"').toEqual({
      message: 'Syntax Error: Invalid character within String: U+D83D.',
      locations: [{ line: 1, column: 28 }],
    });

    expectSyntaxError('"cannot escape half a pair \\uD83D\uDE00 esc"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uD83D".',
      locations: [{ line: 1, column: 28 }],
    });

    expectSyntaxError('"bad \\uD83D\\not an escape"').toEqual({
      message: 'Syntax Error: Invalid Unicode escape sequence: "\\uD83D".',
      locations: [{ line: 1, column: 6 }],
    });
  });

  it('lexes block strings', () => {
    expect(lexOne('""""""')).toMatchSnapshot();
    expect(lexOne('"""simple"""')).toMatchSnapshot();

    expect(lexOne('""" white space """')).toMatchSnapshot();

    expect(lexOne('"""contains " quote"""')).toMatchSnapshot();
    expect(lexOne('"""contains \\""" triple quote"""')).toMatchSnapshot();
    expect(lexOne('"""multi\nline"""')).toMatchSnapshot();

    expect(lexOne('"""multi\rline\r\nnormalized"""')).toMatchSnapshot();
    expect(lexOne('"""unescaped \\n\\r\\b\\t\\f\\u1234"""')).toMatchSnapshot();

    expect(
      lexOne('"""unescaped unicode outside BMP \u{1f600}"""'),
    ).toMatchSnapshot();
    expect(lexOne('"""slashes \\\\ \\/"""')).toMatchSnapshot();
    expect(
      lexOne(`"""

        spans
          multiple
            lines

        """`),
    ).toMatchSnapshot();
  });

  it('advance line after lexing multiline block string', () => {
    expect(
      lexSecond(`"""

        spans
          multiple
            lines

        \n """ second_token`),
    ).toMatchSnapshot();

    expect(
      lexSecond(
        [
          '""" \n',
          'spans \r\n',
          'multiple \n\r',
          'lines \n\n',
          '"""\n second_token',
        ].join(''),
      ),
    ).toMatchSnapshot();
  });

  it('lex reports useful block string errors', () => {
    expectSyntaxError('"""').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 4 }],
    });

    expectSyntaxError('"""no end quote').toEqual({
      message: 'Syntax Error: Unterminated string.',
      locations: [{ line: 1, column: 16 }],
    });

    expectSyntaxError('"""contains invalid surrogate \uDEAD"""').toEqual({
      message: 'Syntax Error: Invalid character within String: U+DEAD.',
      locations: [{ line: 1, column: 31 }],
    });
  });

  it('lexes numbers', () => {
    expect(lexOne('4')).toMatchSnapshot();

    expect(lexOne('4.123')).toMatchSnapshot();

    expect(lexOne('-4')).toMatchSnapshot();
    expect(lexOne('9')).toMatchSnapshot();

    expect(lexOne('0')).toMatchSnapshot();

    expect(lexOne('-4.123')).toMatchSnapshot();

    expect(lexOne('0.123')).toMatchSnapshot();

    expect(lexOne('123e4')).toMatchSnapshot();

    expect(lexOne('123E4')).toMatchSnapshot();

    expect(lexOne('123e-4')).toMatchSnapshot();
    expect(lexOne('123e+4')).toMatchSnapshot();
    expect(lexOne('-1.123e4')).toMatchSnapshot();

    expect(lexOne('-1.123E4')).toMatchSnapshot();

    expect(lexOne('-1.123e-4')).toMatchSnapshot();
    expect(lexOne('-1.123e+4')).toMatchSnapshot();

    expect(lexOne('-1.123e4567')).toMatchSnapshot();
  });

  it('lex reports useful number errors', () => {
    expectSyntaxError('00').toEqual({
      message: 'Syntax Error: Invalid number, unexpected digit after 0: "0".',
      locations: [{ line: 1, column: 2 }],
    });

    expectSyntaxError('01').toEqual({
      message: 'Syntax Error: Invalid number, unexpected digit after 0: "1".',
      locations: [{ line: 1, column: 2 }],
    });

    expectSyntaxError('01.23').toEqual({
      message: 'Syntax Error: Invalid number, unexpected digit after 0: "1".',
      locations: [{ line: 1, column: 2 }],
    });

    expectSyntaxError('+1').toEqual({
      message: 'Syntax Error: Unexpected character: "+".',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('1.').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: <EOF>.',
      locations: [{ line: 1, column: 3 }],
    });

    expectSyntaxError('1e').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: <EOF>.',
      locations: [{ line: 1, column: 3 }],
    });

    expectSyntaxError('1E').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: <EOF>.',
      locations: [{ line: 1, column: 3 }],
    });

    expectSyntaxError('1.e1').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "e".',
      locations: [{ line: 1, column: 3 }],
    });

    expectSyntaxError('.123').toEqual({
      message: 'Syntax Error: Unexpected character: ".".',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('1.A').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "A".',
      locations: [{ line: 1, column: 3 }],
    });

    expectSyntaxError('-A').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "A".',
      locations: [{ line: 1, column: 2 }],
    });

    expectSyntaxError('1.0e').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: <EOF>.',
      locations: [{ line: 1, column: 5 }],
    });

    expectSyntaxError('1.0eA').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "A".',
      locations: [{ line: 1, column: 5 }],
    });

    expectSyntaxError('1.0e"').toEqual({
      message: "Syntax Error: Invalid number, expected digit but got: '\"'.",
      locations: [{ line: 1, column: 5 }],
    });

    expectSyntaxError('1.2e3e').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "e".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('1.2e3.4').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: ".".',
      locations: [{ line: 1, column: 6 }],
    });

    expectSyntaxError('1.23.4').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: ".".',
      locations: [{ line: 1, column: 5 }],
    });
  });

  it('lex does not allow name-start after a number', () => {
    expectSyntaxError('0xF1').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "x".',
      locations: [{ line: 1, column: 2 }],
    });
    expectSyntaxError('0b10').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "b".',
      locations: [{ line: 1, column: 2 }],
    });
    expectSyntaxError('123abc').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "a".',
      locations: [{ line: 1, column: 4 }],
    });
    expectSyntaxError('1_234').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "_".',
      locations: [{ line: 1, column: 2 }],
    });
    expectSyntaxError('1\u00DF').toEqual({
      message: 'Syntax Error: Unexpected character: U+00DF.',
      locations: [{ line: 1, column: 2 }],
    });
    expectSyntaxError('1.23f').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "f".',
      locations: [{ line: 1, column: 5 }],
    });
    expectSyntaxError('1.234_5').toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "_".',
      locations: [{ line: 1, column: 6 }],
    });
  });

  it('lexes punctuation', () => {
    expect(lexOne('!')).toMatchSnapshot();
    expect(lexOne('$')).toMatchSnapshot();
    expect(lexOne('(')).toMatchSnapshot();
    expect(lexOne(')')).toMatchSnapshot();
    expect(lexOne('...')).toMatchSnapshot();
    expect(lexOne(':')).toMatchSnapshot();
    expect(lexOne('=')).toMatchSnapshot();
    expect(lexOne('@')).toMatchSnapshot();
    expect(lexOne('[')).toMatchSnapshot();
    expect(lexOne(']')).toMatchSnapshot();
    expect(lexOne('{')).toMatchSnapshot();
    expect(lexOne('|')).toMatchSnapshot();
    expect(lexOne('}')).toMatchSnapshot();
  });

  it('lex reports useful unknown character error', () => {
    expectSyntaxError('..').toEqual({
      message: 'Syntax Error: Unexpected character: ".".',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('~').toEqual({
      message: 'Syntax Error: Unexpected character: "~".',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\x00').toEqual({
      message: 'Syntax Error: Unexpected character: U+0000.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\b').toEqual({
      message: 'Syntax Error: Unexpected character: U+0008.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\u00AA').toEqual({
      message: 'Syntax Error: Unexpected character: U+00AA.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\u0AAA').toEqual({
      message: 'Syntax Error: Unexpected character: U+0AAA.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\u203B').toEqual({
      message: 'Syntax Error: Unexpected character: U+203B.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\u{1f600}').toEqual({
      message: 'Syntax Error: Unexpected character: U+1F600.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\uD83D\uDE00').toEqual({
      message: 'Syntax Error: Unexpected character: U+1F600.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\uD800\uDC00').toEqual({
      message: 'Syntax Error: Unexpected character: U+10000.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\uDBFF\uDFFF').toEqual({
      message: 'Syntax Error: Unexpected character: U+10FFFF.',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('\uDEAD').toEqual({
      message: 'Syntax Error: Invalid character: U+DEAD.',
      locations: [{ line: 1, column: 1 }],
    });
  });

  it('lex reports useful information for dashes in names', () => {
    const source = new Source('a-b');
    const lexer = new Lexer(source);
    const firstToken = lexer.advance();
    expect({ ...firstToken }).toMatchSnapshot();

    expectToThrowJSON(() => lexer.advance()).toEqual({
      message: 'Syntax Error: Invalid number, expected digit but got: "b".',
      locations: [{ line: 1, column: 3 }],
    });
  });

  it('produces double linked list of tokens, including comments', () => {
    const source = new Source(`
      {
        #comment
        field
      }
    `);

    const lexer = new Lexer(source);
    const startToken = lexer.token;
    let endToken;
    do {
      endToken = lexer.advance();
    } while (endToken.kind !== TokenKind.EOF);

    expect(startToken.prev).toEqual(null);
    expect(endToken.next).toEqual(null);

    const tokens = [];
    for (let tok: Token | null = startToken; tok; tok = tok.next) {
      if (tokens.length) {
        // Tokens are double-linked, prev should point to last seen token.
        expect(tok.prev).toEqual(tokens[tokens.length - 1]);
      }
      tokens.push(tok);
    }

    expect(tokens.map((tok) => tok.kind)).toEqual([
      TokenKind.SOF,
      TokenKind.BRACE_L,
      TokenKind.COMMENT,
      TokenKind.NAME,
      TokenKind.BRACE_R,
      TokenKind.EOF,
    ]);
  });

  it('lexes comments', () => {
    expect(lexOne('# Comment').prev).toMatchSnapshot();
    expect(lexOne('# Comment\nAnother line').prev).toMatchSnapshot();
    expect(lexOne('# Comment\r\nAnother line').prev).toMatchSnapshot();
    expect(lexOne('# Comment \u{1f600}').prev).toMatchSnapshot();
    expectSyntaxError('# Invalid surrogate \uDEAD').toEqual({
      message: 'Syntax Error: Invalid character: U+DEAD.',
      locations: [{ line: 1, column: 21 }],
    });
  });
});

describe('isPunctuatorTokenKind', () => {
  function isPunctuatorToken(text: string) {
    return isPunctuatorTokenKind(lexOne(text).kind);
  }

  it('returns true for punctuator tokens', () => {
    expect(isPunctuatorToken('!')).toEqual(true);
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
