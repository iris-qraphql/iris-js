import { withWrappers } from '../../type/make';
import type { IrisSchema } from '../../type/schema';
import { buildSchema } from '../../type/schema';

import { irisError } from '../../error';
import { inspect } from '../../utils/legacy';
import { toJSONDeep } from '../../utils/toJSONDeep';

import { validateSchema } from '../validate-schema';

const resolverField = (name: string): IrisSchema =>
  buildSchema(`
  data SomeScalar = Int
  resolver SomeObject = { f: SomeObject }
  resolver SomeUnion = SomeObject
  data SomeEnum = ONLY {}
  data SomeInputObject = { val: String }
  directive @SomeDirective on QUERY

  resolver BadObject = {
      badField: ${name}
  }
  
  resolver Query = {
      f: BadObject
    }
`);

function schemaWithFieldType(
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

const expectJSONEqual = (schema: IrisSchema, value: unknown) =>
  expect(toJSONDeep(validateSchema(schema))).toEqual(value);

const snapshot = (schema: IrisSchema) =>
  expect(toJSONDeep(validateSchema(schema))).toMatchSnapshot();

describe('basic Cases', () => {
  it("can't build recursive Union", () => {
    const schema = buildSchema(`
      resolver Hello = Hello

      resolver Query = {
        hello: Hello
      }
    `);
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('can build invalid schema', () => {
    // Invalid schema, because it is missing query root type
    const schema = buildSchema('resolver Mutation');
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('Type System: A Schema must have Object root types', () => {
  it('rejects a Schema whose query root resolver is not an Object', () => {
    const schema = buildSchema(`
      data Query = {
        test: String
      }
    `);
    expectJSONEqual(schema, [
      {
        message: 'Query root type must be Object type, it cannot be Query.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });

  it('rejects a Schema whose mutation type is an data type', () => {
    const schema = buildSchema(`
      resolver Query = {
        field: String
      }

      data Mutation = {
        test: String
      }
    `);
    expectJSONEqual(schema, [
      {
        message:
          'Mutation root type must be Object type if provided, it cannot be Mutation.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);
  });

  it('rejects a Schema whose subscription type is an data type', () => {
    const schema = buildSchema(`
      resolver Query = {
        field: String
      }

      data Subscription = {
        test: String
      }
    `);
    expectJSONEqual(schema, [
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be Subscription.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);
  });
});

describe('Type System: Objects must have fields', () => {
  it('accepts an Object type with fields object', () => {
    const schema = buildSchema(`
      resolver Query = {
        field: SomeObject
      }

      resolver SomeObject = {
        field: String
      }
    `);
    expectJSONEqual(schema, []);
  });

  it('accept an resolver with empty fields', () => {
    const schema = buildSchema(`
      resolver Query = {
        test: IncompleteObject
      }

      resolver IncompleteObject
    `);
    expectJSONEqual(schema, []);
  });

  it('rejects an Object type with incorrectly named fields', () => {
    snapshot(
      schemaWithFieldType('resolver', 'SomeObject', '{ __badName: String}'),
    );
  });
});

describe('Type System: Fields args must be properly named', () => {
  it('accepts field args with valid names', () => {
    const schema = schemaWithFieldType(
      'resolver',
      'SomeObject',
      '{ goodField(goodArg: String): String }',
    );
    expectJSONEqual(schema, []);
  });

  it('rejects field arg with invalid names', () => {
    snapshot(
      schemaWithFieldType(
        'resolver',
        'SomeObject',
        '{ badField(__badName: String): String}',
      ),
    );
  });

  describe('Type System: Union types must be valid', () => {
    it('accepts a Union type with member types', () => {
      const schema = buildSchema(`
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
      expectJSONEqual(schema, []);
    });

    it('rejects a Union type with non-Object members types', () => {
      const schema = buildSchema(`
      resolver Query = {
        test: BadUnion
      }

      resolver TypeA = {
        field: String
      }

      resolver TypeB = {
        field: String
      }

      resolver BadUnion
        = TypeA
        | String
        | TypeB
        | Int
    `);

      expectJSONEqual(schema, [
        {
          message:
            'Union type BadUnion can only include Object types, it cannot include String.',
          locations: [{ line: 16, column: 11 }],
        },
        {
          message:
            'Union type BadUnion can only include Object types, it cannot include Int.',
          locations: [{ line: 18, column: 11 }],
        },
      ]);
    });
  });

  describe('Type System: Input Objects must have fields', () => {
    it('accepts an Input Object type with fields', () => {
      const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        field: String
      }
    `);
      expectJSONEqual(schema, []);
    });

    it('accept empty data type', () => {
      const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject
    `);

      expectJSONEqual(schema, []);
    });

    it('accepts an Input Object with breakable circular reference', () => {
      const schema = buildSchema(`
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

      expectJSONEqual(schema, []);
    });

    it('accept recursive data types', () => {
      const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        nonNullSelf: SomeInputObject
      }
    `);

      expectJSONEqual(schema, []);
    });

    it('rejects an Input Object type with incorrectly typed fields', () => {
      const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      resolver SomeObject = {
        field: String
      }

      resolver SomeUnion = SomeObject

      data SomeInputObject = {
        badObject: SomeObject
        badUnion: SomeUnion
        goodInputObject: SomeInputObject
      }
    `);
      expectJSONEqual(schema, [
        {
          message:
            'The type of SomeInputObject.badObject must be Input Type but got: SomeObject.',
          locations: [{ line: 13, column: 20 }],
        },
        {
          message:
            'The type of SomeInputObject.badUnion must be Input Type but got: SomeUnion.',
          locations: [{ line: 14, column: 19 }],
        },
      ]);
    });
  });

  describe('Type System: Enum types must be well defined', () => {
    it('rejects an Enum type with incorrectly named values', () => {
      snapshot(schemaWithFieldType('data', 'SomeEnum', '__badName {}'));
    });
  });

  describe('Type System: Object fields must have output types', () => {
    const outputTypes = [
      'String',
      'SomeScalar',
      'SomeEnum',
      'SomeObject',
      'SomeUnion',
    ];

    for (const type of outputTypes.flatMap(withWrappers)) {
      it(`accepts an output type as an Object field type: ${inspect(
        type,
      )}`, () => {
        expectJSONEqual(resolverField(type), []);
      });
    }

    it('accept data as resolver field type', () => {
      const schema = buildSchema(`
      resolver Query = {
        field: [SomeInputObject]
      }

      data SomeInputObject = {
        field: String
      }
    `);
      expectJSONEqual(schema, []);
    });
  });

  describe('assertValidSchema', () => {
    it('do not throw on valid schemas', () => {
      const schema = buildSchema(`
      resolver Query = {
        foo: String
      }
    `);
      expect(validateSchema(schema)).toEqual([]);
    });

    it('include multiple errors into a description', () => {
      const schema = buildSchema('resolver SomeType');
      expect(validateSchema(schema)).toEqual([
        irisError('Query root type must be provided.'),
      ]);
    });
  });
});
