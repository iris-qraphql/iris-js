import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { IrisType } from './definition';
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
