import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { Role } from '../language/ast';

import type { ObjMap } from '../utils/ObjMap';

import { buildSchema } from './buildASTSchema';
import type {
  IrisFieldConfig,
  IrisType,
  IrisTypeDefinition,
  Thunk,
} from './definition';
import {
  IrisDataType,
  IrisResolverType,
  IrisTypeRef,
  resolveThunk,
} from './definition';

export const emptyDataType = (name: string) => new IrisDataType({ name });


type GQLObject = {
  name: string;
  description?: string;
  fields: Thunk<ObjMap<IrisFieldConfig<'resolver'>>>;
};

export const gqlObject = ({ name, fields, description }: GQLObject) =>
  new IrisResolverType({
    name,
    variants: () => [{ name, description, fields: resolveThunk(fields) }],
    description,
  });

export const gqlScalar = <I, O>(config: GraphQLScalarTypeConfig<I, O>) =>
  new IrisDataType<I, O>({
    name: config.name,
    description: config.description,
    scalar: new GraphQLScalarType(config),
  });

export const maybe = <T extends IrisType>(ofType: T) =>
  new IrisTypeRef('MAYBE', ofType);

export const gqlList = <T extends IrisType>(ofType: T) =>
  new IrisTypeRef('LIST', ofType);


type TypeDef<R extends Role> = {
  role: R;
  name: string;
  body: string;
};

export const sampleType = <R extends Role>({ role, name, body }: TypeDef<R>) => {
  const schema = buildSchema(`
    ${role} ${name} = ${body}
    resolver Query = {
      f: ${name}
    }
  `);

  return schema.getType(name) as IrisTypeDefinition<R>;
};

