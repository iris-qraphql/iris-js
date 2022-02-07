import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { Role } from '../language/ast';

import type { ObjMap } from '../utils/ObjMap';

import { buildSchema } from './buildASTSchema';
import type {
  IrisFieldConfig,
  IrisNamedType,
  IrisType,
  Thunk,
} from './definition';
import { IrisTypeDefinition, IrisTypeRef, resolveThunk } from './definition';

export const emptyDataType = (name: string) =>
  new IrisTypeDefinition({ role: 'data', name, variants: [] });

type GQLObject = {
  name: string;
  description?: string;
  fields: Thunk<ObjMap<IrisFieldConfig<'resolver'>>>;
};

export const gqlObject = ({ name, fields, description }: GQLObject) =>
  new IrisTypeDefinition({
    role: 'resolver',
    name,
    variants: () => [{ name, description, fields: resolveThunk(fields) }],
    description,
  });

export const gqlScalar = <I, O>(config: GraphQLScalarTypeConfig<I, O>) =>
  new IrisTypeDefinition({
    role: 'data',
    name: config.name,
    description: config.description,
    scalar: new GraphQLScalarType(config),
    variants: [],
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

export const sampleType = <R extends Role>({
  role,
  name,
  body,
}: TypeDef<R>) => {
  const schema = buildSchema(`
    ${role} ${name} = ${body}
    resolver Query = {
      f: ${name}
    }
  `);

  return schema.getType(name) as IrisNamedType<R>;
};
