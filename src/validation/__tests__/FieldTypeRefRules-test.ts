import { withWrappers } from '../../utils/generators';
import { inspect } from '../../utils/legacy';
import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { ValidateField } from '../rules/ValidateField';

const expectSDLErrors = (sdlStr: string) =>
  expect(getSDLValidationErrors(ValidateField, sdlStr));

const resolverField = (name: string) =>
  expectSDLErrors(`
  data SomeScalar = Int
  resolver SomeObject = { f: SomeObject }
  resolver SomeUnion = SomeObject
  data SomeEnum = ONLY {}
  data SomeInputObject = { val: String }
  directive @SomeDirective on QUERY

  resolver BadObject = {
      badField: ${name}
  }
  
  resolver Query = {
      f: BadObject
    }
`);

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
  `).toMatchSnapshot();
  });

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

    it('accept data as resolver field type', () => {
      expectSDLErrors(`
      resolver Query = {
        field: [SomeInputObject]
      }

      data SomeInputObject = {
        field: String
      }
    `).toEqual([]);
    });
  });
});
