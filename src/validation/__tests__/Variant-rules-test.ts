import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { IncludeOnlyVariantTypes } from '../rules/IncludeOnlyVariantTypes';

const expectSDLErrors = (sdlStr: string) =>
  expect(getSDLValidationErrors(IncludeOnlyVariantTypes, sdlStr));

describe('VariantType Rules', () => {
  it('rejects a Union type with non-Object members types', () => {
    expectSDLErrors(`
      data Query = {
        test: BadUnion
      }

      data TypeA = {
        field: String
      }

      data TypeB = {
        field: String
      }

      data BadUnion
        = TypeA
        | String
        | TypeB
        | Int
    `).toMatchSnapshot();
  });

  it("can't build recursive Union", () => {
    expectSDLErrors(`
    data Hello = Hello

    data Query = {
      hello: Hello
    }
  `).toMatchSnapshot();
  });
});
