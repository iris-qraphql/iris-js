import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { IncludeOnlyVariantTypes } from '../rules/IncludeOnlyVariantTypes';

const expectSDLErrors = (sdlStr: string) =>
  expect(getSDLValidationErrors(IncludeOnlyVariantTypes, sdlStr));

describe('VariantType Rules', () => {
  it('rejects a Union type with non-Object members types', () => {
    expectSDLErrors(`
      data A = {
        field: String
      }

      data BadUnion = A | String | Int
    `).toMatchSnapshot();
  });

  it("can't build recursive Union", () => {
    expectSDLErrors(`
    data Hello = Hello
  `).toMatchSnapshot();
  });
});
