import type { IrisSchema } from '../../types/schema';
import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { IncludeOnlyVariantTypes } from '../rules/IncludeOnlyVariantTypes';

function expectSDLErrors(sdlStr: string, schema?: IrisSchema) {
  return expect(
    getSDLValidationErrors(schema, IncludeOnlyVariantTypes, sdlStr),
  );
}

describe('VariantType Rules', () => {
  it('rejects a Union type with non-Object members types', () => {
    expectSDLErrors(`
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
    `).toMatchSnapshot();
  });

  it("can't build recursive Union", () => {
    expectSDLErrors(`
    resolver Hello = Hello

    resolver Query = {
      hello: Hello
    }
  `).toMatchSnapshot();
  });
});
