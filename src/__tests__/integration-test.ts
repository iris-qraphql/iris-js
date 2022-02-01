import { iris, IrisResolverType, IrisSchema, IrisString } from '../index';
import { toJSONDeep } from '../utils/toJSONDeep';

const schema = new IrisSchema({
  query: new IrisResolverType({
    name: 'Query',
    variants: [
      {
        name: 'Query',
        fields: { hello: { type: IrisString } },
      },
    ],
  }),
});

const rootValue = {
  hello: () => 'world',
};

describe('Integration', () => {
  it('hello world App', async () => {
    const result = await iris({ schema, rootValue, source: '{ hello }' });

    expect(toJSONDeep(result)).toEqual({
      data: {
        hello: 'world',
      },
    });
  });
});
