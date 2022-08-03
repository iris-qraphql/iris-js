import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type {IrisTypeRef } from '../types/kind';
import { IrisTypeDefinition} from '../types/kind';
import { buildSchema } from '../types/schema';

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
): IrisTypeRef<R> => {
  const { types } = buildSchema(`
    ${defs}
    resolver Query = {
      f: ${ref}
    }
  `);
  const fields = types.Query?.variantBy().fields ?? {};
  return fields.f.type as IrisTypeRef<R>;
};

export const withWrappers = (type: string): Array<string> => [
  type,
  `${type}?`,
  `[${type}]`,
  `[${type}]?`,
  `[${type}?]`,
  `[${type}?]?`,
];
