import type { GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLScalarType } from 'graphql';

import type { TypeDefinitionNode, TypeNode } from '../types/ast';
import { buildSchema } from '../types/schema';

export const gqlScalar = <I, O>(
  config: GraphQLScalarTypeConfig<I, O>,
): TypeDefinitionNode => ({
  role: 'data',
  name: config.name,
  description: config.description,
  scalar: new GraphQLScalarType(config),
  variants: [],
});

export const sampleTypeRef = (ref: string, defs: string = ''): TypeNode => {
  const { types } = buildSchema(`
    ${defs}
    resolver Query = {
      f: ${ref}
    }
  `);
  const fields = types.Query?.variantBy().fields ?? {};
  return fields.f.type as TypeNode;
};

export const withWrappers = (type: string): Array<string> => [
  type,
  `${type}?`,
  `[${type}]`,
  `[${type}]?`,
  `[${type}?]`,
  `[${type}?]?`,
];
