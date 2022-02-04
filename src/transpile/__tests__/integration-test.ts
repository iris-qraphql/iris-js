import { buildSchema } from '../../type/buildASTSchema';

import { iris } from '../../index';
import { toJSONDeep } from '../../utils/toJSONDeep';

describe('Simple Integration', () => {
  const schema = buildSchema(`
  resolver Query = {
    hello: String
  }
`);

  const rootValue = {
    hello: () => 'world',
  };

  it('hello world App', async () => {
    const result = await iris({ schema, rootValue, source: '{ hello }' });

    expect(toJSONDeep(result)).toEqual({
      data: {
        hello: 'world',
      },
    });
  });
});

describe('Sophisticated Integration', () => {
  const schema = buildSchema(`
  data Lifespan
    = Immortal {}
    | Limited { max: Int? }

  resolver God = {
    name: String
    lifespan: Lifespan
  }

  resolver Deity
    = God
    | Titan { name: String }

  resolver Query = {
    deities(lifespan: Lifespan?): [Deity]
  }
  `);

  const validDeities = () => [
    {
      __typename: 'God',
      name: 'Morpheus',
      lifespan: 'Immortal',
    },
    {
      __typename: 'Deity_Titan',
      name: 'Cronos',
    },
  ];

  const api = (deities: () => Array<unknown>, query: string) =>
    iris({ schema, rootValue: { deities }, source: query });

  it('union type names', async () => {
    const result = await api(validDeities, '{ deities { __typename } }');

    expect(toJSONDeep(result)).toMatchSnapshot();
  });

  it('conditional union selections', async () => {
    const result = await api(
      validDeities,
      `{ 
        deities { 
          __typename
          ... on God {
            name
            lifespan
          }
          ... on Deity_Titan {
            name
          }
        } 
    }`,
    );

    expect(toJSONDeep(result)).toMatchSnapshot();
  });

  it('conditional union selections', async () => {
    const result = await api(
      () => [
        {
          __typename: 'God',
          name: 'Morpheus',
          lifespan: 'Thor',
        },
      ],
      `{ 
        deities { 
          __typename
          ... on God {
            name
            lifespan
          }
          ... on Deity_Titan {
            name
          }
        } 
    }`,
    );

    expect(toJSONDeep(result)).toMatchSnapshot();
  });
});
