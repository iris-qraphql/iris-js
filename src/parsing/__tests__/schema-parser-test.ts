import { dedent } from '../../utils/dedent';
import { toJSONDeep, toJSONError } from '../../utils/toJSONDeep';

import { parse } from '../parser';

function expectSyntaxError(text: string) {
  return expect(toJSONError(() => parse(text)));
}

const snapshot = (doc: string) =>
  expect(toJSONDeep(parse(doc))).toMatchSnapshot();

describe('Schema Parser', () => {
  it('Simple data', () => {
    snapshot(dedent`
      data Hello = {
        world: String
      }
    `);
  });

  it('parses data with description string', () => {
    snapshot(dedent`
      "Description"
      data Hello = {
        world: String
      }
    `);
  });

  it('parses data with description multi-line string', () => {
    snapshot(dedent`
      """
      Description
      """
      # Even with comments between them
      data Hello = {
        world: String
      }
    `);
  });

  it('Description followed by something other than data system definition throws', () => {
    expectSyntaxError('"Description" 1').toEqual({
      locations: [{ column: 15, line: 1 }],
      message: 'Syntax Error: Unexpected Int "1".',
    });
  });

  it('Simple non-null resolver', () => {
    snapshot(dedent`
      data Hello = {
        world: String
      }
    `);
  });

  it('Single value Enum', () => {
    snapshot('data Hello = WORLD {}');
  });

  it('Double value Enum', () => {
    snapshot('data Hello = WO {} | RLD {}');
  });

  it('Simple resolver', () => {
    snapshot('data Hello = World');
  });

  it('Union with two resolvers', () => {
    snapshot('data Hello = Wo | Rld');
  });

  it('Union fails with no resolvers', () => {
    expectSyntaxError('data Hello =  ').toMatchSnapshot();
  });

  it('Union fails with leading pipe', () => {
    expectSyntaxError('data Hello = | Wo | Rld').toMatchSnapshot();
  });

  it('Union fails with double pipe', () => {
    expectSyntaxError('data Hello = Wo || Rld').toMatchSnapshot();
  });

  it('Union fails with trailing pipe', () => {
    expectSyntaxError('data Hello = Wo | Rld |').toMatchSnapshot();
  });

  it('Scalar', () => {
    snapshot('data Hello = String');
  });

  it('Simple data object', () => {
    snapshot(`
    data Hello = {
      world: String
    }`);
  });

  describe('reject reserved names', () => {
    it('rejects an Enum type with incorrectly named values', () => {
      expectSyntaxError(`
        data SomeEnum 
          = __badName {}
        `).toMatchSnapshot();
    });

    it('rejects field arg with invalid names', () => {
      expectSyntaxError(`
        data SomeObject = {
          badField(__badName: String): String
        }
      `).toMatchSnapshot();
    });

    it('rejects an Object type with incorrectly named fields', () => {
      expectSyntaxError(`
        data SomeObject = {
          __badName: String
        }
      `).toMatchSnapshot();
    });
  });
});
