import type { ObjMap } from '../jsutils/ObjMap';

import type {
  GraphQLFieldConfig,
  GraphQLInputField,
  GraphQLIsTypeOfFn,
  ThunkObjMap,
} from './definition';
import { IrisDataType, IrisResolverType } from './definition';

type InputC = {
  name: string;
  fields: ObjMap<Omit<GraphQLInputField, 'name'>>;
};

export const emptyDataType = (name: string) => new IrisDataType({ name });

const gqlInput = ({ name, fields }: InputC) =>
  new IrisDataType({
    name,
    variants: [
      {
        name,
        fields,
      },
    ],
  });

const gqlEnum = (name: string, values: Array<string>) =>
  new IrisDataType({
    name,
    variants: values.map((v) => ({ name: v })),
  });

type GQLObject = {
  name: string;
  description?: string;
  fields: ThunkObjMap<GraphQLFieldConfig<any, any>>;
  isTypeOf?: GraphQLIsTypeOfFn<any, any>;
};

const gqlObject = ({ name, fields, isTypeOf, description }: GQLObject) =>
  new IrisResolverType({ name, fields, isTypeOf, description });

export { gqlInput, gqlEnum, gqlObject };
