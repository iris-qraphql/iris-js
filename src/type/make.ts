import type { ObjMap } from '../jsutils/ObjMap';

import type {
  GraphQLFieldConfig,
  GraphQLInputField,
  GraphQLIsTypeOfFn,
  GraphQLTypeResolver,
  ThunkObjMap,
  ThunkReadonlyArray,
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

type GQLUnion = {
  name: string;
  types: ThunkReadonlyArray<IrisResolverType>;
  resolveType?: GraphQLTypeResolver<any, any>;
};
const gqlUnion = ({ name, types, resolveType }: GQLUnion) =>
  new IrisResolverType({ name, types, resolveType });

export { gqlInput, gqlEnum, gqlObject, gqlUnion };
