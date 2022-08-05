import { GQLKind } from '../../types/kinds';
import { toJSONDeep, toJSONError } from '../../utils/toJSONDeep';

import { parse } from '../index';
import { parseConstValue, parseType, parseValue } from '../parser';

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
        kind: GQLKind.NULL,
        loc: { start: 0, end: 4 },
      });
    });

    it('parses list values', () => {
      const result = parseValue('[123 "abc"]');
      expectJSON(result).toEqual({
        kind: GQLKind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          {
            kind: GQLKind.INT,
            loc: { start: 1, end: 4 },
            value: '123',
          },
          {
            kind: GQLKind.STRING,
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
        kind: GQLKind.LIST,
        loc: { start: 0, end: 20 },
        values: [
          {
            kind: GQLKind.STRING,
            loc: { start: 1, end: 11 },
            value: 'long',
            block: true,
          },
          {
            kind: GQLKind.STRING,
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
        kind: GQLKind.OBJECT,
        loc: { start: 0, end: 15 },
        fields: [
          {
            kind: GQLKind.OBJECT_FIELD,
            loc: { start: 2, end: 13 },
            name: {
              kind: GQLKind.NAME,
              loc: { start: 2, end: 7 },
              value: 'field',
            },
            value: {
              kind: GQLKind.VARIABLE,
              loc: { start: 9, end: 13 },
              name: {
                kind: GQLKind.NAME,
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
        kind: GQLKind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          {
            kind: GQLKind.INT,
            loc: { start: 1, end: 4 },
            value: '123',
          },
          {
            kind: GQLKind.STRING,
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
        kind: GQLKind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: GQLKind.NAME,
          loc: { start: 0, end: 6 },
          value: 'String',
        },
      });
    });

    it('parses custom types', () => {
      const result = parseType('MyType');
      expectJSON(result).toEqual({
        kind: GQLKind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: GQLKind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType',
        },
      });
    });

    it('parses list types', () => {
      const result = parseType('[MyType]');
      expectJSON(result).toEqual({
        kind: GQLKind.LIST_TYPE,
        loc: { start: 0, end: 8 },
        type: {
          kind: GQLKind.NAMED_TYPE,
          loc: { start: 1, end: 7 },
          name: {
            kind: GQLKind.NAME,
            loc: { start: 1, end: 7 },
            value: 'MyType',
          },
        },
      });
    });

    it('parses optional types', () => {
      const result = parseType('MyType?');
      expectJSON(result).toMatchSnapshot();
    });

    it('parses nested types', () => {
      const result = parseType('[MyType?]');
      expectJSON(result).toMatchSnapshot();
    });
  });
});
