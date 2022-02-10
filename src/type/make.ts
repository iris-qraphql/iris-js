import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { Role } from '../language/ast';

import type { IrisType } from './definition';
import { IrisTypeDefinition } from './definition';
import { buildSchema } from './schema';

export const gqlScalar = <I, O>(config: GraphQLScalarTypeConfig<I, O>) =>
  new IrisTypeDefinition({
    role: 'data',
    name: config.name,
    description: config.description,
    scalar: new GraphQLScalarType(config),
    variants: [],
  });

export const sampleTypeRef = <R extends Role>(
  ref: string,
  defs: string = '',
): IrisType<R> => {
  const { query } = buildSchema(`
    ${defs}
    resolver Query = {
      f: ${ref}
    }
  `);
  const fields = query?.variantBy().fields ?? {};
  return fields.f.type as IrisType<R>;
};

export const withWrappers = (type: string): Array<string> => [
  type,
  `${type}?`,
  `[${type}]`,
  `[${type}]?`,
  `[${type}?]`,
  `[${type}?]?`,
];
