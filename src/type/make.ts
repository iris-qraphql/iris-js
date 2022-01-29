import type { ObjMap } from '../jsutils/ObjMap';

import type {
  DataLiteralParser,
  DataParser,
  DataSerializer,
  GraphQLFieldConfig,
  IrisDataVariantField,
  IrisResolverVariantConfig,
  ThunkObjMap,
} from './definition';
import { IrisDataType, IrisResolverType } from './definition';

type InputC = {
  name: string;
  fields: ObjMap<Omit<IrisDataVariantField, 'name'>>;
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

type GQLObject<S = any> = {
  name: string;
  description?: string;
  fields: ThunkObjMap<GraphQLFieldConfig<S, any>>;
};

const gqlObject = <S>({ name, fields, description }: GQLObject<S>) =>
  new IrisResolverType({
    name,
    variants: [{ name, description, fields }],
    description,
  });

type GQLUnion = {
  name: string;
  types: ReadonlyArray<IrisResolverType>;
};

const gqlUnion = ({ name, types }: GQLUnion) =>
  new IrisResolverType({
    name,
    variants: types.map(
      (type): IrisResolverVariantConfig => ({
        name: type.name,
        type: () => type,
      }),
    ),
  });

type GQLScalar<I = unknown, O = I> = {
  name: string;
  description?: string;
  serialize?: DataSerializer<O>;
  parseValue?: DataParser<I>;
  parseLiteral?: DataLiteralParser<I>;
};

const gqlScalar = <T>(x: GQLScalar<T>) =>
  new IrisDataType<T>({ ...x, isPrimitive: true });

export { gqlInput, gqlEnum, gqlObject, gqlUnion, gqlScalar };
