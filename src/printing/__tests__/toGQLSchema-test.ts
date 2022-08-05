
import { buildSchema } from '../../types/schema';

import { toTSDefinitions } from '../toTSDefinitions';

const matchGQLSnapshot = (src: string) =>
  expect(toTSDefinitions(buildSchema(src))).toMatchSnapshot();

describe('toGQLSchema', () => {
  it('hello world App', () => {
    matchGQLSnapshot(`
    data  Query = {
      hello: String
    }
  `);
  });

  it('hello world App', () => {
    matchGQLSnapshot(`
      data Lifespan
        = Immortal {}
        | Limited { max: Int? }

      data God = {
        name: String
        lifespan: Lifespan
      }

      data Deity
        = God
        | Titan { name: String }
    `);
  });
});
