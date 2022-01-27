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

  return expect(mapException);
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
    expect(lexOne('""')).toEqual(
      expect.objectContaining({
        kind: TokenKind.STRING,
        start: 0,
        end: 2,
        value: '',
      }),
    );

    expect(lexOne('"simple"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 8,
      value: 'simple',
    });

    expect(lexOne('" white space "')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: ' white space ',
    });

    expect(lexOne('"quote \\""')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 10,
      value: 'quote "',
    });

    expect(lexOne('"escaped \\n\\r\\b\\t\\f"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 20,
      value: 'escaped \n\r\b\t\f',
    });

    expect(lexOne('"slashes \\\\ \\/"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 15,
      value: 'slashes \\ /',
    });

    expect(lexOne('"unescaped unicode outside BMP \u{1f600}"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 34,
      value: 'unescaped unicode outside BMP \u{1f600}',
    });

    expect(
      lexOne('"unescaped maximal unicode outside BMP \u{10ffff}"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 42,
      value: 'unescaped maximal unicode outside BMP \u{10ffff}',
    });

    expect(lexOne('"unicode \\u1234\\u5678\\u90AB\\uCDEF"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 34,
      value: 'unicode \u1234\u5678\u90AB\uCDEF',
    });

    expect(lexOne('"unicode \\u{1234}\\u{5678}\\u{90AB}\\u{CDEF}"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 42,
      value: 'unicode \u1234\u5678\u90AB\uCDEF',
    });

    expect(
      lexOne('"string with unicode escape outside BMP \\u{1F600}"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 50,
      value: 'string with unicode escape outside BMP \u{1f600}',
    });

    expect(lexOne('"string with minimal unicode escape \\u{0}"')).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 42,
      value: 'string with minimal unicode escape \u{0}',
    });

    expect(
      lexOne('"string with maximal unicode escape \\u{10FFFF}"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 47,
      value: 'string with maximal unicode escape \u{10FFFF}',
    });

    expect(
      lexOne('"string with maximal minimal unicode escape \\u{00000000}"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 57,
      value: 'string with maximal minimal unicode escape \u{0}',
    });

    expect(
      lexOne('"string with unicode surrogate pair escape \\uD83D\\uDE00"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 56,
      value: 'string with unicode surrogate pair escape \u{1f600}',
    });

    expect(
      lexOne('"string with minimal surrogate pair escape \\uD800\\uDC00"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 56,
      value: 'string with minimal surrogate pair escape \u{10000}',
    });

    expect(
      lexOne('"string with maximal surrogate pair escape \\uDBFF\\uDFFF"'),
    ).toContain({
      kind: TokenKind.STRING,
      start: 0,
      end: 56,
      value: 'string with maximal surrogate pair escape \u{10FFFF}',
    });
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
    expect(lexOne('""""""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 6,
      line: 1,
      column: 1,
      value: '',
    });

    expect(lexOne('"""simple"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 12,
      line: 1,
      column: 1,
      value: 'simple',
    });

    expect(lexOne('""" white space """')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 19,
      line: 1,
      column: 1,
      value: ' white space ',
    });

    expect(lexOne('"""contains " quote"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 22,
      line: 1,
      column: 1,
      value: 'contains " quote',
    });

    expect(lexOne('"""contains \\""" triple quote"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 32,
      line: 1,
      column: 1,
      value: 'contains """ triple quote',
    });

    expect(lexOne('"""multi\nline"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 16,
      line: 1,
      column: 1,
      value: 'multi\nline',
    });

    expect(lexOne('"""multi\rline\r\nnormalized"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 28,
      line: 1,
      column: 1,
      value: 'multi\nline\nnormalized',
    });

    expect(lexOne('"""unescaped \\n\\r\\b\\t\\f\\u1234"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 32,
      line: 1,
      column: 1,
      value: 'unescaped \\n\\r\\b\\t\\f\\u1234',
    });

    expect(lexOne('"""unescaped unicode outside BMP \u{1f600}"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 38,
      line: 1,
      column: 1,
      value: 'unescaped unicode outside BMP \u{1f600}',
    });

    expect(lexOne('"""slashes \\\\ \\/"""')).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 19,
      line: 1,
      column: 1,
      value: 'slashes \\\\ \\/',
    });

    expect(
      lexOne(`"""

        spans
          multiple
            lines

        """`),
    ).toContain({
      kind: TokenKind.BLOCK_STRING,
      start: 0,
      end: 68,
      line: 1,
      column: 1,
      value: 'spans\n  multiple\n    lines',
    });
  });

  it('advance line after lexing multiline block string', () => {
    expect(
      lexSecond(`"""

        spans
          multiple
            lines

        \n """ second_token`),
    ).toContain({
      kind: TokenKind.NAME,
      start: 71,
      end: 83,
      line: 8,
      column: 6,
      value: 'second_token',
    });

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
    ).toContain({
      kind: TokenKind.NAME,
      start: 37,
      end: 49,
      line: 8,
      column: 2,
      value: 'second_token',
    });
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
    expect(lexOne('4')).toContain({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '4',
    });

    expect(lexOne('4.123')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '4.123',
    });

    expect(lexOne('-4')).toContain({
      kind: TokenKind.INT,
      start: 0,
      end: 2,
      value: '-4',
    });

    expect(lexOne('9')).toContain({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '9',
    });

    expect(lexOne('0')).toContain({
      kind: TokenKind.INT,
      start: 0,
      end: 1,
      value: '0',
    });

    expect(lexOne('-4.123')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '-4.123',
    });

    expect(lexOne('0.123')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '0.123',
    });

    expect(lexOne('123e4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123e4',
    });

    expect(lexOne('123E4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 5,
      value: '123E4',
    });

    expect(lexOne('123e-4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e-4',
    });

    expect(lexOne('123e+4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 6,
      value: '123e+4',
    });

    expect(lexOne('-1.123e4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123e4',
    });

    expect(lexOne('-1.123E4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 8,
      value: '-1.123E4',
    });

    expect(lexOne('-1.123e-4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e-4',
    });

    expect(lexOne('-1.123e+4')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 9,
      value: '-1.123e+4',
    });

    expect(lexOne('-1.123e4567')).toContain({
      kind: TokenKind.FLOAT,
      start: 0,
      end: 11,
      value: '-1.123e4567',
    });
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
    expect(lexOne('!')).toContain({
      kind: TokenKind.BANG,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('$')).toContain({
      kind: TokenKind.DOLLAR,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('(')).toContain({
      kind: TokenKind.PAREN_L,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne(')')).toContain({
      kind: TokenKind.PAREN_R,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('...')).toContain({
      kind: TokenKind.SPREAD,
      start: 0,
      end: 3,
      value: undefined,
    });

    expect(lexOne(':')).toContain({
      kind: TokenKind.COLON,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('=')).toContain({
      kind: TokenKind.EQUALS,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('@')).toContain({
      kind: TokenKind.AT,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('[')).toContain({
      kind: TokenKind.BRACKET_L,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne(']')).toContain({
      kind: TokenKind.BRACKET_R,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('{')).toContain({
      kind: TokenKind.BRACE_L,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('|')).toContain({
      kind: TokenKind.PIPE,
      start: 0,
      end: 1,
      value: undefined,
    });

    expect(lexOne('}')).toContain({
      kind: TokenKind.BRACE_R,
      start: 0,
      end: 1,
      value: undefined,
    });
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
    expect(firstToken).toContain({
      kind: TokenKind.NAME,
      start: 0,
      end: 1,
      value: 'a',
    });

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
      // Lexer advances over ignored comment tokens to make writing parsers
      // easier, but will include them in the linked list result.
      expect(endToken.kind).toEqual(TokenKind.COMMENT);
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
    expect(lexOne('# Comment').prev).toContain({
      kind: TokenKind.COMMENT,
      start: 0,
      end: 9,
      value: ' Comment',
    });
    expect(lexOne('# Comment\nAnother line').prev).toContain({
      kind: TokenKind.COMMENT,
      start: 0,
      end: 9,
      value: ' Comment',
    });
    expect(lexOne('# Comment\r\nAnother line').prev).toContain({
      kind: TokenKind.COMMENT,
      start: 0,
      end: 9,
      value: ' Comment',
    });
    expect(lexOne('# Comment \u{1f600}').prev).toContain({
      kind: TokenKind.COMMENT,
      start: 0,
      end: 12,
      value: ' Comment \u{1f600}',
    });
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
