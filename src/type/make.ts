import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { Role } from '../language/ast';

import { buildSchema } from './buildASTSchema';
import type { IrisNamedType, IrisType } from './definition';
import { IrisTypeDefinition, IrisTypeRef } from './definition';

export const emptyDataType = (name: string) =>
  new IrisTypeDefinition({ role: 'data', name, variants: [] });

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

export type TypeDef<R extends Role = Role> = {
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
