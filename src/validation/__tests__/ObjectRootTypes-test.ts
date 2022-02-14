import { getSDLValidationErrors } from '../../utils/toJSONDeep';

import { ObjectRootTypes } from '../rules/ObjectRootTypes';

const expectSDLErrors = (sdlStr: string) =>
  expect(getSDLValidationErrors(ObjectRootTypes, sdlStr));

describe('Type System: A Schema must have Object root types', () => {
  it('rejects a Schema whose query root resolver is not an Object', () => {
    expectSDLErrors(`
        data Query = {
          test: String
        }
      `).toMatchSnapshot();
  });

  it('rejects a Schema whose mutation type is an data type', () => {
    expectSDLErrors(`
        resolver Query = {
          field: String
        }
  
        data Mutation = {
          test: String
        }
      `).toMatchSnapshot();
  });

  it('rejects a Schema whose subscription type is an data type', () => {
    expectSDLErrors(`
        resolver Query = {
          field: String
        }
  
        data Subscription = {
          test: String
        }
      `).toMatchSnapshot();
  });
});
