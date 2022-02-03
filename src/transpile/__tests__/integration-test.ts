import { buildSchema } from '../../type/buildASTSchema';

import { iris } from '../../index';
import { toJSONDeep } from '../../utils/toJSONDeep';

describe('Integration', () => {
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
