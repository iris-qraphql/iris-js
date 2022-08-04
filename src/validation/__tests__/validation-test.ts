import type { IrisSchema } from '../../types/schema';
import { buildSchema } from '../../types/schema';

function validSchemaWithField(
  kind: 'data' | 'resolver',
  name: string,
  body: string,
): IrisSchema {
  return buildSchema(`
    ${kind} ${name} = ${body}
    data Query = {
      f: ${name}
    }
  `);
}

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

describe('Type System: Fields args must be properly named', () => {
  it('accepts field args with valid names', () => {
    validSchemaWithField(
      'resolver',
      'SomeObject',
      '{ goodField(goodArg: String): String }',
    );
  });

  describe('Type System: Union types must be valid', () => {
    it('accepts a Union type with member types', () => {
      validSchema(`
      data Query = {
        test: GoodUnion
      }

      data TypeA = {
        field: String
      }

      data TypeB = {
        field: String
      }

      data GoodUnion 
        = TypeA
        | TypeB
    `);
    });
  });
  describe('Type System: Input Objects must have fields', () => {
    it('accepts an Input Object type with fields', () => {
      validSchema(`
      data Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        field: String
      }
    `);
    });

    it('accept empty data type', () => {
      validSchema(`
      data Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject
    `);
    });

    it('accepts an Input Object with breakable circular reference', () => {
      validSchema(`
      data Query = {
        field(arg: SomeInputObject): String
      }

      data  SomeInputObject = {
        self: SomeInputObject?
        arrayOfSelf: [SomeInputObject?]?
        nonNullArrayOfSelf: [SomeInputObject?]
        nonNullArrayOfNonNullSelf: [SomeInputObject]
        intermediateSelf: AnotherInputObject
      }

      data  AnotherInputObject = {
        parent: SomeInputObject
      }
    `);
    });

    it('accept recursive data types', () => {
      validSchema(`
      data Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        nonNullSelf: SomeInputObject
      }
    `);
    });
  });

  describe('assertValidSchema', () => {
    it('do not throw on valid schemas', () => {
      validSchema(`
      data Query = {
        foo: String
      }
    `);
    });

    // TODO:
    // it('include multiple errors into a description', () => {
    //   const schema = buildSchema('data SomeType');
    //   expect(schema).toEqual([irisError('Query root type must be provided.')]);
    // });
  });
});
