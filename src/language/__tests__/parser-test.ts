import { Kind, Source } from 'graphql';

import { dedent } from '../../utils/dedent';
import { toJSONDeep, toJSONError } from '../../utils/toJSONDeep';

import { parse, parseConstValue, parseType, parseValue } from '../parser';

export function expectJSON(actual: unknown) {
  const actualJSON = toJSONDeep(actual);
  return expect(actualJSON);
}

function expectSyntaxError(text: string) {
  return expect(toJSONError(() => parse(text)));
}

describe('Parser', () => {
  it('parse provides useful errors', () => {
    expectSyntaxError('data').toEqual({
      locations: [{ column: 5, line: 1 }],
      message: 'Syntax Error: Expected Name, found <EOF>.',
    });

    expectSyntaxError('...').toEqual({
      message: 'Syntax Error: Unexpected "...".',
      locations: [{ line: 1, column: 1 }],
    });
  });

  it('parse provides useful error when using source', () => {
    let caughtError;
    try {
      parse(new Source('resolver', 'MyQuery.graphql'));
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).toEqual(dedent`
      Syntax Error: Expected Name, found <EOF>.

      MyQuery.graphql:1:9
      1 | resolver
        |         ^
    `);
  });

  it('does not allow "true", "false", or "null" as Enum value', () => {
    expectSyntaxError('data Test = VALID | true ').toEqual({
      message:
        'Syntax Error: Name "true" is reserved and cannot be used for an enum value.',
      locations: [{ line: 1, column: 21 }],
    });

    expectSyntaxError('data Test = VALID | false').toEqual({
      message:
        'Syntax Error: Name "false" is reserved and cannot be used for an enum value.',
      locations: [{ line: 1, column: 21 }],
    });

    expectSyntaxError('data Test = VALID | null').toEqual({
      message:
        'Syntax Error: Name "null" is reserved and cannot be used for an enum value.',
      locations: [{ line: 1, column: 21 }],
    });
  });

  describe('parseValue', () => {
    it('parses null value', () => {
      const result = parseValue('null');
      expectJSON(result).toEqual({
        kind: Kind.NULL,
        loc: { start: 0, end: 4 },
      });
    });

    it('parses list values', () => {
      const result = parseValue('[123 "abc"]');
      expectJSON(result).toEqual({
        kind: Kind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          {
            kind: Kind.INT,
            loc: { start: 1, end: 4 },
            value: '123',
          },
          {
            kind: Kind.STRING,
            loc: { start: 5, end: 10 },
            value: 'abc',
            block: false,
          },
        ],
      });
    });

    it('parses block strings', () => {
      const result = parseValue('["""long""" "short"]');
      expectJSON(result).toEqual({
        kind: Kind.LIST,
        loc: { start: 0, end: 20 },
        values: [
          {
            kind: Kind.STRING,
            loc: { start: 1, end: 11 },
            value: 'long',
            block: true,
          },
          {
            kind: Kind.STRING,
            loc: { start: 12, end: 19 },
            value: 'short',
            block: false,
          },
        ],
      });
    });

    it('allows variables', () => {
      const result = parseValue('{ field: $var }');
      expectJSON(result).toEqual({
        kind: Kind.OBJECT,
        loc: { start: 0, end: 15 },
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            loc: { start: 2, end: 13 },
            name: {
              kind: Kind.NAME,
              loc: { start: 2, end: 7 },
              value: 'field',
            },
            value: {
              kind: Kind.VARIABLE,
              loc: { start: 9, end: 13 },
              name: {
                kind: Kind.NAME,
                loc: { start: 10, end: 13 },
                value: 'var',
              },
            },
          },
        ],
      });
    });

    it('correct message for incomplete variable', () => {
      expect(() => parseValue('$')).toThrow();
      // .to.deep.include({
      //   message: 'Syntax Error: Expected Name, found <EOF>.',
      //   locations: [{ line: 1, column: 2 }],
      // });
    });

    it('correct message for unexpected token', () => {
      expect(() => parseValue(':')).toThrow();
      // .to.deep.include({
      //   message: 'Syntax Error: Unexpected ":".',
      //   locations: [{ line: 1, column: 1 }],
      // });
    });
  });

  describe('parseConstValue', () => {
    it('parses values', () => {
      const result = parseConstValue('[123 "abc"]');
      expectJSON(result).toEqual({
        kind: Kind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          {
            kind: Kind.INT,
            loc: { start: 1, end: 4 },
            value: '123',
          },
          {
            kind: Kind.STRING,
            loc: { start: 5, end: 10 },
            value: 'abc',
            block: false,
          },
        ],
      });
    });

    it('correct message for unexpected token', () => {
      expect(toJSONError(() => parseConstValue('$'))).toEqual({
        message: 'Syntax Error: Unexpected "$".',
        locations: [{ line: 1, column: 1 }],
      });
    });
  });

  describe('parseType', () => {
    it('parses well known types', () => {
      const result = parseType('String');
      expectJSON(result).toEqual({
        kind: Kind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'String',
        },
      });
    });

    it('parses custom types', () => {
      const result = parseType('MyType');
      expectJSON(result).toEqual({
        kind: Kind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType',
        },
      });
    });

    it('parses list types', () => {
      const result = parseType('[MyType]');
      expectJSON(result).toEqual({
        kind: Kind.LIST_TYPE,
        loc: { start: 0, end: 8 },
        type: {
          kind: Kind.NAMED_TYPE,
          loc: { start: 1, end: 7 },
          name: {
            kind: Kind.NAME,
            loc: { start: 1, end: 7 },
            value: 'MyType',
          },
        },
      });
    });

    it('parses non-null types', () => {
      const result = parseType('MyType!');
      expectJSON(result).toEqual({
        kind: Kind.NON_NULL_TYPE,
        loc: { start: 0, end: 7 },
        type: {
          kind: Kind.NAMED_TYPE,
          loc: { start: 0, end: 6 },
          name: {
            kind: Kind.NAME,
            loc: { start: 0, end: 6 },
            value: 'MyType',
          },
        },
      });
    });

    it('parses nested types', () => {
      const result = parseType('[MyType!]');
      expectJSON(result).toEqual({
        kind: Kind.LIST_TYPE,
        loc: { start: 0, end: 9 },
        type: {
          kind: Kind.NON_NULL_TYPE,
          loc: { start: 1, end: 8 },
          type: {
            kind: Kind.NAMED_TYPE,
            loc: { start: 1, end: 7 },
            name: {
              kind: Kind.NAME,
              loc: { start: 1, end: 7 },
              value: 'MyType',
            },
          },
        },
      });
    });
  });
});
