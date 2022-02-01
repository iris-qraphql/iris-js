import { inspect } from '../../jsutils/inspect';

import { DirectiveLocation } from '../../language/directiveLocation';

import { buildSchema } from '../../utilities/buildASTSchema';

import { GraphQLError } from '../../error';
import { toJSONDeep } from '../../utils/toJSONDeep';
import type { ConfigMapValue } from '../../utils/type-level';

import type {
  GraphQLArgument,
  GraphQLFieldConfig,
  IrisNamedType,
  IrisStrictType,
  IrisType,
  IrisTypeRef,
} from '../definition';
import { assertDataType, assertResolverType } from '../definition';
import { assertDirective, GraphQLDirective } from '../directives';
import { gqlEnum, gqlList, gqlObject, gqlUnion, maybe } from '../make';
import { IrisString } from '../scalars';
import { IrisSchema } from '../schema';
import { validateSchema } from '../validate';

const SomeSchema = buildSchema(`
  data SomeScalar = Int

  resolver SomeObject = { f: SomeObject }

  resolver SomeUnion = SomeObject

  data SomeEnum = ONLY {}

  data SomeInputObject = { val: String }

  directive @SomeDirective on QUERY
`);

const SomeScalarType = assertDataType(SomeSchema.getType('SomeScalar'));
const SomeObjectType = assertResolverType(SomeSchema.getType('SomeObject'));
const SomeUnionType = assertResolverType(SomeSchema.getType('SomeUnion'));
const SomeEnumType = assertDataType(SomeSchema.getType('SomeEnum'));
const SomeInputObjectType = assertDataType(
  SomeSchema.getType('SomeInputObject'),
);

const SomeDirective = assertDirective(SomeSchema.getDirective('SomeDirective'));

function withModifiers<T extends IrisNamedType>(
  type: T,
): Array<T | IrisTypeRef<T | IrisTypeRef<T>>> {
  return [type, gqlList(type), maybe(type), maybe(gqlList(type))];
}

const outputTypes: ReadonlyArray<IrisType> = [
  ...withModifiers(IrisString),
  ...withModifiers(SomeScalarType),
  ...withModifiers(SomeEnumType),
  ...withModifiers(SomeObjectType),
  ...withModifiers(SomeUnionType),
];

const inputTypes: ReadonlyArray<IrisStrictType> = [
  ...withModifiers(IrisString),
  ...withModifiers(SomeScalarType),
  ...withModifiers(SomeEnumType),
  ...withModifiers(SomeInputObjectType),
];

const notInputTypes: ReadonlyArray<IrisType> = [
  ...withModifiers(SomeObjectType),
  ...withModifiers(SomeUnionType),
];

function schemaWithFieldType(type: IrisType): IrisSchema {
  return new IrisSchema({
    query: gqlObject({
      name: 'Query',
      fields: { f: { type } },
    }),
  });
}

const expectJSON = (schema: IrisSchema) =>
  expect(toJSONDeep(validateSchema(schema)));

const expectJSONEqual = (schema: IrisSchema, value: unknown) =>
  expect(toJSONDeep(validateSchema(schema))).toEqual(value);

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

  it('rejects a Schema whose types are incorrectly typed', () => {
    const schema = new IrisSchema({
      query: SomeObjectType,
      // @ts-expect-error
      types: [{ name: 'SomeType' }, SomeDirective],
    });
    expectJSONEqual(schema, [
      {
        message: 'Expected GraphQL named type but got: { name: "SomeType" }.',
      },
      {
        message: 'Expected GraphQL named type but got: @SomeDirective.',
        locations: [{ line: 12, column: 3 }],
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
    const schema = schemaWithFieldType(
      gqlObject({
        name: 'SomeObject',
        fields: {
          __badName: { type: IrisString },
        },
      }),
    );
    expectJSONEqual(schema, [
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
  });
});

describe('Type System: Fields args must be properly named', () => {
  it('accepts field args with valid names', () => {
    const schema = schemaWithFieldType(
      gqlObject({
        name: 'SomeObject',
        fields: {
          goodField: {
            type: IrisString,
            args: {
              goodArg: { type: IrisString },
            },
          },
        },
      }),
    );
    expectJSONEqual(schema, []);
  });

  it('rejects field arg with invalid names', () => {
    const schema = schemaWithFieldType(
      gqlObject({
        name: 'SomeObject',
        fields: {
          badField: {
            type: IrisString,
            args: {
              __badName: { type: IrisString },
            },
          },
        },
      }),
    );

    expectJSONEqual(schema, [
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
  });
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

    const badUnionMemberTypes = [
      IrisString,
      maybe(SomeObjectType),
      gqlList(SomeObjectType),
      SomeUnionType,
      SomeEnumType,
      SomeInputObjectType,
    ];
    for (const memberType of badUnionMemberTypes) {
      const badUnion = gqlUnion({
        name: 'BadUnion',
        // @ts-expect-error
        types: [memberType],
      });
      expectJSONEqual(schemaWithFieldType(badUnion), [
        {
          message:
            'Union type BadUnion can only include Object types, ' +
            `it cannot include ${inspect(memberType)}.`,
        },
      ]);
    }
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
    const schema = schemaWithFieldType(gqlEnum('SomeEnum', ['__badName']));

    expectJSONEqual(schema, [
      {
        message:
          'Name "__badName" must not begin with "__", which is reserved by GraphQL introspection.',
      },
    ]);
  });
});

describe('Type System: Object fields must have output types', () => {
  function schemaWithObjectField(
    fieldConfig: GraphQLFieldConfig<unknown, unknown>,
  ): IrisSchema {
    const BadObjectType = gqlObject({
      name: 'BadObject',
      fields: {
        badField: fieldConfig,
      },
    });

    return new IrisSchema({
      query: gqlObject({
        name: 'Query',
        fields: {
          f: { type: BadObjectType },
        },
      }),
      types: [SomeObjectType],
    });
  }

  for (const type of outputTypes) {
    const typeName = inspect(type);
    it(`accepts an output type as an Object field type: ${typeName}`, () => {
      const schema = schemaWithObjectField({ type });
      expectJSONEqual(schema, []);
    });
  }

  it('rejects a non-type value as an Object field type', () => {
    // @ts-expect-error
    const schema = schemaWithObjectField({ type: Number });
    expectJSONEqual(schema, [
      {
        message:
          'The type of BadObject.badField must be Output Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

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

describe('Type System: Arguments must have data  types', () => {
  function schemaWithArg(
    argConfig: ConfigMapValue<GraphQLArgument>,
  ): IrisSchema {
    const BadObjectType = gqlObject({
      name: 'BadObject',
      fields: {
        badField: {
          type: IrisString,
          args: {
            badArg: argConfig,
          },
        },
      },
    });

    return new IrisSchema({
      query: gqlObject({
        name: 'Query',
        fields: {
          f: { type: BadObjectType },
        },
      }),
      directives: [
        new GraphQLDirective({
          name: 'BadDirective',
          args: {
            badArg: argConfig,
          },
          locations: [DirectiveLocation.QUERY],
        }),
      ],
    });
  }

  for (const type of inputTypes) {
    const typeName = inspect(type);
    it(`accepts an data  type as a field arg type: ${typeName}`, () => {
      const schema = schemaWithArg({ type });
      expectJSONEqual(schema, []);
    });
  }

  for (const type of notInputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-input type as a field arg type: ${typeStr}`, () => {
      // @ts-expect-error
      const schema = schemaWithArg({ type });
      expectJSONEqual(schema, [
        {
          message: `The type of @BadDirective(badArg:) must be Input Type but got: ${typeStr}.`,
        },
        {
          message: `The type of BadObject.badField(badArg:) must be Input Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as a field arg type', () => {
    // @ts-expect-error
    const schema = schemaWithArg({ type: Number });
    expectJSONEqual(schema, [
      {
        message:
          'The type of @BadDirective(badArg:) must be Input Type but got: [function Number].',
      },
      {
        message:
          'The type of BadObject.badField(badArg:) must be Input Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

  it('rejects an required argument that is deprecated', () => {
    const schema = buildSchema(`
      directive @BadDirective(
        badArg: String @deprecated
        optionalArg: String? @deprecated
        anotherOptionalArg: String = "" @deprecated
      ) on FIELD

      resolver Query = {
        test(
          badArg: String @deprecated
          optionalArg: String? @deprecated
          anotherOptionalArg: String = "" @deprecated
        ): String
      }
    `);
    expectJSON(schema).toMatchSnapshot();
  });

  it('rejects a non-input type as a field arg with locations', () => {
    const schema = buildSchema(`
      resolver Query = {
        test(arg: SomeObject): String
      }

      resolver SomeObject = {
        foo: String
      }
    `);
    expectJSON(schema).toMatchSnapshot();
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
      new GraphQLError('Query root type must be provided.'),
    ]);
  });
});
