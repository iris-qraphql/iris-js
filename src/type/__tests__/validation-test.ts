import { dedent } from '../../__testUtils__/dedent';

import { inspect } from '../../jsutils/inspect';
import { toJSONDeep } from '../../jsutils/toJSONDeep';

import { DirectiveLocation } from '../../language/directiveLocation';

import { buildSchema } from '../../utilities/buildASTSchema';

import type {
  GraphQLArgumentConfig,
  GraphQLFieldConfig,
  GraphQLInputType,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../definition';
import {
  assertDataType,
  assertObjectType,
  assertResolverType,
  assertScalarType,
  GraphQLList,
  GraphQLNonNull,
} from '../definition';
import { assertDirective, GraphQLDirective } from '../directives';
import { gqlEnum, gqlObject, gqlUnion } from '../make';
import { GraphQLString } from '../scalars';
import { GraphQLSchema } from '../schema';
import { assertValidSchema, validateSchema } from '../validate';

const SomeSchema = buildSchema(`
  scalar SomeScalar

  resolver SomeObject = { f: SomeObject }

  resolver SomeUnion = SomeObject

  data SomeEnum = ONLY

  data SomeInputObject = { val: String = "hello" }

  directive @SomeDirective on QUERY
`);

const SomeScalarType = assertScalarType(SomeSchema.getType('SomeScalar'));
const SomeObjectType = assertObjectType(SomeSchema.getType('SomeObject'));
const SomeUnionType = assertResolverType(SomeSchema.getType('SomeUnion'));
const SomeEnumType = assertDataType(SomeSchema.getType('SomeEnum'));
const SomeInputObjectType = assertDataType(
  SomeSchema.getType('SomeInputObject'),
);

const SomeDirective = assertDirective(SomeSchema.getDirective('SomeDirective'));

function withModifiers<T extends GraphQLNamedType>(
  type: T,
): Array<T | GraphQLList<T> | GraphQLNonNull<T | GraphQLList<T>>> {
  return [
    type,
    new GraphQLList(type),
    new GraphQLNonNull(type),
    new GraphQLNonNull(new GraphQLList(type)),
  ];
}

const outputTypes: ReadonlyArray<GraphQLOutputType> = [
  ...withModifiers(GraphQLString),
  ...withModifiers(SomeScalarType),
  ...withModifiers(SomeEnumType),
  ...withModifiers(SomeObjectType),
  ...withModifiers(SomeUnionType),
];

const notOutputTypes: ReadonlyArray<GraphQLInputType> = [
  ...withModifiers(SomeInputObjectType),
];

const inputTypes: ReadonlyArray<GraphQLInputType> = [
  ...withModifiers(GraphQLString),
  ...withModifiers(SomeScalarType),
  ...withModifiers(SomeEnumType),
  ...withModifiers(SomeInputObjectType),
];

const notInputTypes: ReadonlyArray<GraphQLOutputType> = [
  ...withModifiers(SomeObjectType),
  ...withModifiers(SomeUnionType),
];

function schemaWithFieldType(type: GraphQLOutputType): GraphQLSchema {
  return new GraphQLSchema({
    query: gqlObject({
      name: 'Query',
      fields: { f: { type } },
    }),
  });
}

const expectedJSON = (schema: GraphQLSchema, value: unknown) =>
  expect(toJSONDeep(validateSchema(schema))).toEqual(value);

describe('Type System: A Schema must have Object root types', () => {
  it('rejects a Schema whose query root resolver is not an Object', () => {
    const schema = buildSchema(`
      data Query = {
        test: String
      }
    `);
    expectedJSON(schema, [
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

      data Mutation {
        test: String
      }
    `);
    expectedJSON(schema, [
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

      data Subscription {
        test: String
      }
    `);
    expectedJSON(schema, [
      {
        message:
          'Subscription root type must be Object type if provided, it cannot be Subscription.',
        locations: [{ line: 6, column: 7 }],
      },
    ]);
  });

  it('rejects a Schema whose types are incorrectly typed', () => {
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      // @ts-expect-error
      types: [{ name: 'SomeType' }, SomeDirective],
    });
    expectedJSON(schema, [
      {
        message: 'Expected GraphQL named type but got: { name: "SomeType" }.',
      },
      {
        message: 'Expected GraphQL named type but got: @SomeDirective.',
        locations: [{ line: 12, column: 3 }],
      },
    ]);
  });

  it('rejects a Schema whose directives are incorrectly typed', () => {
    const schema = new GraphQLSchema({
      query: SomeObjectType,
      // @ts-expect-error
      directives: [null, 'SomeDirective', SomeScalarType],
    });
    expectedJSON(schema, [
      {
        message: 'Expected directive but got: null.',
      },
      {
        message: 'Expected directive but got: "SomeDirective".',
      },
      {
        message: 'Expected directive but got: SomeScalar.',
        locations: [{ line: 2, column: 3 }],
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
    expectedJSON(schema, []);
  });

  it('accept an resolver with empty fields', () => {
    const schema = buildSchema(`
      resolver Query = {
        test: IncompleteObject
      }

      resolver IncompleteObject
    `);
    expectedJSON(schema, []);
  });

  it('rejects an Object type with incorrectly named fields', () => {
    const schema = schemaWithFieldType(
      gqlObject({
        name: 'SomeObject',
        fields: {
          __badName: { type: GraphQLString },
        },
      }),
    );
    expectedJSON(schema, [
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
            type: GraphQLString,
            args: {
              goodArg: { type: GraphQLString },
            },
          },
        },
      }),
    );
    expectedJSON(schema, []);
  });

  it('rejects field arg with invalid names', () => {
    const schema = schemaWithFieldType(
      gqlObject({
        name: 'SomeObject',
        fields: {
          badField: {
            type: GraphQLString,
            args: {
              __badName: { type: GraphQLString },
            },
          },
        },
      }),
    );

    expectedJSON(schema, [
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
    expectedJSON(schema, []);
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

    expectedJSON(schema, [
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
      GraphQLString,
      new GraphQLNonNull(SomeObjectType),
      new GraphQLList(SomeObjectType),
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
      expectedJSON(schemaWithFieldType(badUnion), [
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

      data SomeInputObject {
        field: String
      }
    `);
    expectedJSON(schema, []);
  });

  it('accept empty data type', () => {
    const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject
    `);

    expectedJSON(schema, []);
  });

  it('accepts an Input Object with breakable circular reference', () => {
    const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data  SomeInputObject = {
        self: SomeInputObject
        arrayOfSelf: [SomeInputObject]
        nonNullArrayOfSelf: [SomeInputObject]!
        nonNullArrayOfNonNullSelf: [SomeInputObject!]!
        intermediateSelf: AnotherInputObject
      }

      data  AnotherInputObject = {
        parent: SomeInputObject
      }
    `);

    expectedJSON(schema, []);
  });

  it('rejects an Input Object with non-breakable circular reference', () => {
    const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        nonNullSelf: SomeInputObject!
      }
    `);

    expectedJSON(schema, [
      {
        message:
          'Cannot reference Input Object "SomeInputObject" within itself through a series of non-null fields: "nonNullSelf".',
        locations: [{ line: 7, column: 9 }],
      },
    ]);
  });

  it('rejects Input Objects with non-breakable circular reference spread across them', () => {
    const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data  SomeInputObject {
        startLoop: AnotherInputObject!
      }

      data  AnotherInputObject {
        nextInLoop: YetAnotherInputObject!
      }

      data  YetAnotherInputObject {
        closeLoop: SomeInputObject!
      }
    `);

    expectedJSON(schema, [
      {
        message:
          'Cannot reference Input Object "SomeInputObject" within itself through a series of non-null fields: "startLoop.nextInLoop.closeLoop".',
        locations: [
          { line: 7, column: 9 },
          { line: 11, column: 9 },
          { line: 15, column: 9 },
        ],
      },
    ]);
  });

  it('rejects Input Objects with multiple non-breakable circular reference', () => {
    const schema = buildSchema(`
      resolver Query = {
        field(arg: SomeInputObject): String
      }

      data SomeInputObject = {
        startLoop: AnotherInputObject!
      }

      data AnotherInputObject = {
        closeLoop: SomeInputObject!
        startSecondLoop: YetAnotherInputObject!
      }

      data YetAnotherInputObject = {
        closeSecondLoop: AnotherInputObject!
        nonNullSelf: YetAnotherInputObject!
      }
    `);

    expectedJSON(schema, [
      {
        message:
          'Cannot reference Input Object "SomeInputObject" within itself through a series of non-null fields: "startLoop.closeLoop".',
        locations: [
          { line: 7, column: 9 },
          { line: 11, column: 9 },
        ],
      },
      {
        message:
          'Cannot reference Input Object "AnotherInputObject" within itself through a series of non-null fields: "startSecondLoop.closeSecondLoop".',
        locations: [
          { line: 12, column: 9 },
          { line: 16, column: 9 },
        ],
      },
      {
        message:
          'Cannot reference Input Object "YetAnotherInputObject" within itself through a series of non-null fields: "nonNullSelf".',
        locations: [{ line: 17, column: 9 }],
      },
    ]);
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

      data  SomeInputObject {
        badObject: SomeObject
        badUnion: SomeUnion
        goodInputObject: SomeInputObject
      }
    `);
    expectedJSON(schema, [
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

    expectedJSON(schema, [
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
  ): GraphQLSchema {
    const BadObjectType = gqlObject({
      name: 'BadObject',
      fields: {
        badField: fieldConfig,
      },
    });

    return new GraphQLSchema({
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
      expectedJSON(schema, []);
    });
  }

  for (const type of notOutputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-output type as an Object field type: ${typeStr}`, () => {
      const schema = schemaWithObjectField({ type });
      expectedJSON(schema, [
        {
          message: `The type of BadObject.badField must be Output Type but got: ${typeStr}.`,
        },
      ]);
    });
  }

  it('rejects a non-type value as an Object field type', () => {
    // @ts-expect-error
    const schema = schemaWithObjectField({ type: Number });
    expectedJSON(schema, [
      {
        message:
          'The type of BadObject.badField must be Output Type but got: [function Number].',
      },
      {
        message: 'Expected GraphQL named type but got: [function Number].',
      },
    ]);
  });

  it('rejects with relevant locations for a non-output type as an Object field type', () => {
    const schema = buildSchema(`
      resolver Query = {
        field: [SomeInputObject]
      }

      data  SomeInputObject {
        field: String
      }
    `);
    expectedJSON(schema, [
      {
        message:
          'The type of Query.field must be Output Type but got: [SomeInputObject].',
        locations: [{ line: 3, column: 16 }],
      },
    ]);
  });
});

describe('Type System: Arguments must have data  types', () => {
  function schemaWithArg(argConfig: GraphQLArgumentConfig): GraphQLSchema {
    const BadObjectType = gqlObject({
      name: 'BadObject',
      fields: {
        badField: {
          type: GraphQLString,
          args: {
            badArg: argConfig,
          },
        },
      },
    });

    return new GraphQLSchema({
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
      expectedJSON(schema, []);
    });
  }

  for (const type of notInputTypes) {
    const typeStr = inspect(type);
    it(`rejects a non-input type as a field arg type: ${typeStr}`, () => {
      // @ts-expect-error
      const schema = schemaWithArg({ type });
      expectedJSON(schema, [
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
    expectedJSON(schema, [
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
        badArg: String! @deprecated
        optionalArg: String @deprecated
        anotherOptionalArg: String! = "" @deprecated
      ) on FIELD

      resolver Query = {
        test(
          badArg: String! @deprecated
          optionalArg: String @deprecated
          anotherOptionalArg: String! = "" @deprecated
        ): String
      }
    `);
    expectedJSON(schema, [
      {
        message:
          'Required argument @BadDirective(badArg:) cannot be deprecated.',
        locations: [
          { line: 3, column: 25 },
          { line: 3, column: 17 },
        ],
      },
      {
        message: 'Required argument Query.test(badArg:) cannot be deprecated.',
        locations: [
          { line: 10, column: 27 },
          { line: 10, column: 19 },
        ],
      },
    ]);
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
    expectedJSON(schema, [
      {
        message:
          'The type of Query.test(arg:) must be Input Type but got: SomeObject.',
        locations: [{ line: 3, column: 19 }],
      },
    ]);
  });
});

describe('assertValidSchema', () => {
  it('do not throw on valid schemas', () => {
    const schema = buildSchema(`
      resolver Query = {
        foo: String
      }
    `);
    expect(() => assertValidSchema(schema)).not.toThrow();
  });

  it('include multiple errors into a description', () => {
    const schema = buildSchema('resolver SomeType');
    expect(() => assertValidSchema(schema)).toThrow(
      dedent`Query root type must be provided.`,
    );
  });
});
