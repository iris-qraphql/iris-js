import { withWrappers } from '../../utils/generators';
import { inspect } from '../../utils/legacy';
import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { ValidateField } from '../rules/ValidateField';

const expectSDLErrors = (sdlStr: string) =>
  expect(getSDLValidationErrors(ValidateField, sdlStr));

const resolverField = (name: string) =>
  expectSDLErrors(`
  data SomeScalar = Int
  data SomeObject = { f: SomeObject }
  data SomeUnion = SomeObject
  data SomeEnum = ONLY {}
  data SomeInputObject = { val: String }
  directive @SomeDirective on QUERY

  data BadObject = {
      badField: ${name}
  }
  
  data Query = {
      f: BadObject
    }
`);

describe('Field Rules', () => {
  describe('Type System: Object fields must have output types', () => {
    const outputTypes = [
      'String',
      'SomeScalar',
      'SomeEnum',
      'SomeObject',
      'SomeUnion',
    ].flatMap(withWrappers);

    for (const type of outputTypes) {
      it(`accepts an output type as an Object field type: ${inspect(
        type,
      )}`, () => resolverField(type).toEqual([]));
    }

    it('accept data as data field type', () => {
      expectSDLErrors(`
      data Query = {
        field: [SomeInputObject]
      }

      data SomeInputObject = {
        field: String
      }
    `).toEqual([]);
    });
  });
});
