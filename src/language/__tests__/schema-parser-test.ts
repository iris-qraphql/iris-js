import { dedent } from '../../utils/dedent';
import { toJSONDeep, toJSONError } from '../../utils/toJSONDeep';

import { parse } from '../parser';

function expectSyntaxError(text: string) {
  return expect(toJSONError(() => parse(text)));
}

const snapshot = (doc: string) =>
  expect(toJSONDeep(parse(doc))).toMatchSnapshot();

describe('Schema Parser', () => {
  it('Simple resolver', () => {
    snapshot(dedent`
      resolver Hello = {
        world: String
      }
    `);
  });

  it('parses resolver with description string', () => {
    snapshot(dedent`
      "Description"
      resolver Hello = {
        world: String
      }
    `);
  });

  it('parses resolver with description multi-line string', () => {
    snapshot(dedent`
      """
      Description
      """
      # Even with comments between them
      resolver Hello = {
        world: String
      }
    `);
  });

  it('Description followed by something other than resolver system definition throws', () => {
    expectSyntaxError('"Description" 1').toEqual({
      locations: [{ column: 15, line: 1 }],
      message: 'Syntax Error: Unexpected Int "1".',
    });
  });

  it('Simple non-null resolver', () => {
    snapshot(dedent`
      resolver Hello = {
        world: String!
      }
    `);
  });

  it('Single value Enum', () => {
    snapshot('data Hello = WORLD');
  });

  it('Double value Enum', () => {
    snapshot('data Hello = WO | RLD');
  });

  it('Simple field with arg', () => {
    snapshot(dedent`
      resolver Hello = {
        world(flag: Boolean): String
      }
    `);
  });

  it('Simple field with arg with default value', () => {
    snapshot(dedent`
      resolver Hello = {
        world(flag: Boolean = true): String
      }
    `);
  });

  it('Simple field with list arg', () => {
    snapshot(dedent`
      resolver Hello = {
        world(things: [String]): String
      }
    `);
  });

  it('Simple field with two args', () => {
    snapshot(dedent`
      resolver Hello = {
        world(argOne: Boolean, argTwo: Int): String
      }
    `);
  });

  it('Simple resolver', () => {
    snapshot('resolver Hello = World');
  });

  it('Union with two resolvers', () => {
    snapshot('resolver Hello = Wo | Rld');
  });

  it('Union fails with no resolvers', () => {
    expectSyntaxError('resolver Hello =  ').toEqual({
      message: 'Syntax Error: Expected Variant, found <EOF>.',
      locations: [{ line: 1, column: 19 }],
    });
  });

  it('Union fails with leading pipe', () => {
    expectSyntaxError('resolver Hello = | Wo | Rld').toEqual({
      message: 'Syntax Error: Expected Variant, found "|".',
      locations: [{ line: 1, column: 18 }],
    });
  });

  it('Union fails with double pipe', () => {
    expectSyntaxError('resolver Hello = Wo || Rld').toEqual({
      message: 'Syntax Error: Expected Name, found "|".',
      locations: [{ line: 1, column: 22 }],
    });
  });

  it('Union fails with trailing pipe', () => {
    expectSyntaxError('resolver Hello = Wo | Rld |').toEqual({
      message: 'Syntax Error: Expected Name, found <EOF>.',
      locations: [{ line: 1, column: 28 }],
    });
  });

  it('Scalar', () => {
    snapshot('data Hello = String');
  });

  it('Simple data object', () => {
    snapshot(`
    data Hello {
      world: String
    }`);
  });

  it('Simple data object with args should fail', () => {
    expectSyntaxError(`
      data  Hello {
        world(foo: Int): String
      }
    `).toEqual({
      message: 'Syntax Error: Expected ":", found "(".',
      locations: [{ line: 3, column: 14 }],
    });
  });
});
