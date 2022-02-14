import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { ValidateField } from '../rules/ValidateField';

const expectSDLErrors = (sdlStr: string) =>
  expect(getSDLValidationErrors(ValidateField, sdlStr));

describe('Field Rules', () => {

  it('rejects an Input Object type with incorrectly typed fields', () => {
    expectSDLErrors(`
    resolver Query = {
      field(arg: SomeInputObject): String
    }

    resolver SomeObject = {
      field: String
    }

    resolver SomeUnion = SomeObject

    data SomeInputObject = {
      badObject: SomeObject
      badUnion: SomeUnion
      goodInputObject: SomeInputObject
    }
  `).toMatchSnapshot()
  });
});
