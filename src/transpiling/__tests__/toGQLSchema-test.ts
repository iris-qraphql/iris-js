
import { buildSchema } from '../../types/schema';

import { toTSDefinitions } from '../toTSDefinitions';

const matchGQLSnapshot = (src: string) =>
  expect(toTSDefinitions(buildSchema(src))).toMatchSnapshot();

describe('toGQLSchema', () => {
  it('hello world App', () => {
    matchGQLSnapshot(`
    resolver Query = {
      hello: String
    }
  `);
  });

  it('hello world App', () => {
    matchGQLSnapshot(`
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
  });
});
