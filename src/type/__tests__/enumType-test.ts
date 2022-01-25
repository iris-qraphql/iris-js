import { toJSONDeep } from '../../jsutils/toJSONDeep';

import { graphqlSync } from '../../iris';

import { gqlEnum, gqlObject } from '../make';
import { GraphQLInt } from '../scalars';
import { GraphQLSchema } from '../schema';

const ColorType = gqlEnum('Color', ['RED', 'GREEN', 'BLUE']);

const expectResult = (result: unknown, value: unknown) =>
  expect(toJSONDeep(result)).toEqual(value);

const QueryType = gqlObject({
  name: 'Query',
  fields: {
    colorEnum: {
      type: ColorType,
      args: {
        fromEnum: { type: ColorType },
      },
      resolve: (_source, { fromEnum }) => fromEnum,
    },
    count: {
      type: GraphQLInt,
    },
  },
});

const MutationType = gqlObject({
  name: 'Mutation',
  fields: {
    favoriteEnum: {
      type: ColorType,
      args: { color: { type: ColorType } },
      resolve: (_source, { color }) => color,
    },
  },
});

const SubscriptionType = gqlObject({
  name: 'Subscription',
  fields: {
    subscribeToEnum: {
      type: ColorType,
      args: { color: { type: ColorType } },
      resolve: (_source, { color }) => color,
    },
  },
});

const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  subscription: SubscriptionType,
});

function executeQuery(
  source: string,
  variableValues?: Record<string, unknown>,
) {
  return graphqlSync({ schema, source, variableValues });
}

describe('Type System: Enum Values', () => {
  it('Enum may be both input and output type', () => {
    const result = executeQuery('{ colorEnum(fromEnum: GREEN) }');

    expect(result).toEqual({
      data: { colorEnum: 'GREEN' },
    });
  });

  it('does not accept string literals', () => {
    const result = executeQuery('{ colorEnum(fromEnum: "GREEN") }');

    expectResult(result, {
      errors: [
        {
          message:
            'Data "Color" cannot represent value: "GREEN". Did you mean the enum value "GREEN"?',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept values not in the enum', () => {
    const result = executeQuery('{ colorEnum(fromEnum: GREENISH) }');

    expectResult(result, {
      errors: [
        {
          message:
            'Value "GREENISH" does not exist in "Color" enum. Did you mean the enum value "GREEN"?',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept values with incorrect casing', () => {
    const result = executeQuery('{ colorEnum(fromEnum: green) }');

    expectResult(result, {
      errors: [
        {
          message:
            'Value "green" does not exist in "Color" enum. Did you mean the enum value "GREEN" or "RED"?',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept internal value in place of enum literal', () => {
    const result = executeQuery('{ colorEnum(fromEnum: 1) }');

    expectResult(result, {
      errors: [
        {
          message: 'Data "Color" cannot represent value: 1.',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('accepts JSON string as enum variable', () => {
    const doc = 'query ($color: Color!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 'BLUE' });

    expect(result).toEqual({
      data: { colorEnum: 'BLUE' },
    });
  });

  it('accepts enum literals as input arguments to mutations', () => {
    const doc = 'mutation ($color: Color!) { favoriteEnum(color: $color) }';
    const result = executeQuery(doc, { color: 'GREEN' });

    expect(result).toEqual({
      data: { favoriteEnum: 'GREEN' },
    });
  });

  it('accepts enum literals as input arguments to subscriptions', () => {
    const doc =
      'subscription ($color: Color!) { subscribeToEnum(color: $color) }';
    const result = executeQuery(doc, { color: 'GREEN' });

    expect(result).toEqual({
      data: { subscribeToEnum: 'GREEN' },
    });
  });

  it('does not accept internal value as enum variable', () => {
    const doc = 'query ($color: Color!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 2 });

    expectResult(result, {
      errors: [
        {
          message:
            'Variable "$color" got invalid value 2; Enum "Color" cannot represent non-string value: 2.',
          locations: [{ line: 1, column: 8 }],
        },
      ],
    });
  });

  it('does not accept string variables as Enum input', () => {
    const doc = 'query ($color: String!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 'BLUE' });

    expectResult(result, {
      errors: [
        {
          message:
            'Variable "$color" of type "String!" used in position expecting type "Color".',
          locations: [
            { line: 1, column: 8 },
            { line: 1, column: 47 },
          ],
        },
      ],
    });
  });

  it('does not accept internal value variable as Enum input', () => {
    const doc = 'query ($color: Int!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 2 });

    expectResult(result, {
      errors: [
        {
          message:
            'Variable "$color" of type "Int!" used in position expecting type "Color".',
          locations: [
            { line: 1, column: 8 },
            { line: 1, column: 44 },
          ],
        },
      ],
    });
  });

  it('Enum value may have an internal value of 0', () => {
    const result = executeQuery(`
      {
        colorEnum(fromEnum: RED)
      }
    `);

    expect(result).toEqual({
      data: {
        colorEnum: 'RED',
      },
    });
  });

  it('Enum inputs may be nullable', () => {
    const result = executeQuery(`
      {
        colorEnum
      }
    `);

    expect(result).toEqual({
      data: {
        colorEnum: null,
      },
    });
  });
});
