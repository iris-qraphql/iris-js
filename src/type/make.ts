import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { ObjMap } from '../jsutils/ObjMap';

import type {
  IrisField,
  IrisFieldConfig,
  IrisResolverVariantConfig,
  IrisType,
  Thunk,
} from './definition';
import {
  IrisDataType,
  IrisResolverType,
  IrisTypeRef,
  resolveThunk,
} from './definition';

type InputC = {
  name: string;
  fields: ObjMap<Omit<IrisField<'data'>, 'name'>>;
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
  fields: Thunk<ObjMap<IrisFieldConfig>>;
};

const gqlObject = ({ name, fields, description }: GQLObject) =>
  new IrisResolverType({
    name,
    variants: () => [{ name, description, fields: resolveThunk(fields) }],
    description,
  });

type GQLUnion = {
  name: string;
  types: ReadonlyArray<IrisResolverType>;
};

const gqlUnion = ({ name, types }: GQLUnion) =>
  new IrisResolverType({
    name,
    variants: () =>
      types.map(
        (type): IrisResolverVariantConfig => ({
          name: type.name,
          type,
        }),
      ),
  });

const gqlScalar = <I, O>(config: GraphQLScalarTypeConfig<I, O>) =>
  new IrisDataType<I, O>({
    name: config.name,
    description: config.description,
    scalar: new GraphQLScalarType(config),
  });

export const maybe = <T extends IrisType>(ofType: T) =>
  new IrisTypeRef('MAYBE', ofType);

export const gqlList = <T extends IrisType>(ofType: T) =>
  new IrisTypeRef('LIST', ofType);

export { gqlInput, gqlEnum, gqlObject, gqlUnion, gqlScalar };
