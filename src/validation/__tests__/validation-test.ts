import type { IrisSchema } from '../../types/schema';
import { buildSchema } from '../../types/schema';

function validSchemaWithField(
  kind: 'data' | 'resolver',
  name: string,
  body: string,
): IrisSchema {
  return buildSchema(`
    ${kind} ${name} = ${body}
    resolver Query = {
      f: ${name}
    }
  `);
}

const validSchema = (src: string) =>
  expect(() => buildSchema(src)).not.toThrow();

describe('Type System: Objects must have fields', () => {
  it('accepts an Object type with fields object', () => {
    validSchema(`
      resolver Query = {
        field: SomeObject
      }

      resolver SomeObject = {
        field: String
      }
    `);
  });

  it('accept an resolver with empty fields', () => {
    validSchema(`
      resolver Query = {
        test: IncompleteObject
      }

      resolver IncompleteObject
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
      resolver Query = {
        test: GoodUnion
      }

      resolver TypeA = {
        field: String
      }

      resolver TypeB = {
        field: String
      }

      resolver GoodUnion 
        = TypeA
        | TypeB
    `);
    });
  });
  describe('Type System: Input Objects must have fields', () => {
    it('accepts an Input Object type with fields', () => {
      validSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        field: String
      }
    `);
    });

    it('accept empty data type', () => {
      validSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject
    `);
    });

    it('accepts an Input Object with breakable circular reference', () => {
      validSchema(`
      resolver Query = {
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
      resolver Query = {
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
      resolver Query = {
        foo: String
      }
    `);
    });

    // TODO:
    // it('include multiple errors into a description', () => {
    //   const schema = buildSchema('resolver SomeType');
    //   expect(schema).toEqual([irisError('Query root type must be provided.')]);
    // });
  });
});
