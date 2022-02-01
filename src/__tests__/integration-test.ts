import { iris, IrisResolverType, IrisSchema, IrisString } from '../index';

const schema = new IrisSchema({
  query: new IrisResolverType({
    name: 'Query',
    variants: [
      {
        name: 'Query',
        fields: {
          hello: {
            type: IrisString,
          },
        },
      },
    ],
  }),
});

describe('Integration', () => {
  it('hello world App', async () => {
    const result = await iris({ schema, source: '{ hello }' });

    expect(result).toEqual({
      errors: [
        {
          message: 'Cannot query field BoyHowdy on RootQueryType',
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });
});
