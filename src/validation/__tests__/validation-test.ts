import { buildSchema } from '../../types/schema';

const validSchema = (src: string) =>
  expect(() => buildSchema(src)).not.toThrow();

describe('Type System: Objects must have fields', () => {
  it('accepts an Object type with fields object', () => {
    validSchema(`
      data Query = {
        field: SomeObject
      }

      data SomeObject = {
        field: String
      }
    `);
  });

  it('accept an data with empty fields', () => {
    validSchema(`
      data Query = {
        test: IncompleteObject
      }

      data IncompleteObject
    `);
  });
});
