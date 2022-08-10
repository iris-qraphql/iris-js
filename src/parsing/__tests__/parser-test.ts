import { GQLKind } from '../../types/kinds';
import { toJSONDeep, toJSONError } from '../../utils/toJSONDeep';

import { parse, parseType, parseValue } from '../index';

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
    expectSyntaxError('data Test = VALID | true ').toMatchSnapshot();
    expectSyntaxError('data Test = VALID | false').toMatchSnapshot();
    expectSyntaxError('data Test = VALID | null').toMatchSnapshot();
  });

  describe('parseValue', () => {
    it('parses null value', () => {
      const result = parseValue('null');
      expectJSON(result).toEqual({
        kind: GQLKind.NULL,
        loc: { start: 0, end: 4 },
      });
    });

    it('parses block strings', () => {
      expectJSON(parseValue('"""long"""')).toMatchSnapshot();
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
    it('correct message for unexpected token', () => {
      expect(toJSONError(() => parseValue('$'))).toEqual({
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
