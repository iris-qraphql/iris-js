import type { GraphQLScalarTypeConfig } from 'graphql';
import { Kind } from 'graphql';

import type { TypeDefinitionNode, TypeNode } from '../types/ast';
import { getVariant } from '../types/ast';
import { IrisKind } from '../types/kinds';
import { buildSchema } from '../types/schema';

export const gqlScalar = <I, O>(
  config: GraphQLScalarTypeConfig<I, O>,
): TypeDefinitionNode => ({
  kind: IrisKind.TYPE_DEFINITION,
  name: { kind: Kind.NAME, value: config.name },
  description: config.description
    ? { kind: Kind.STRING, value: config.description }
    : undefined,
  variants: [],
});

export const sampleTypeRef = (ref: string, defs: string = ''): TypeNode => {
  const { types } = buildSchema(`
    ${defs}
    data MyType = {
      f: ${ref}
    }
  `);

  const type = types.MyType;
  const [field] = getVariant(type)?.fields ?? [];
  return field.type;
};

export const withWrappers = (type: string): Array<string> => [
  type,
  `${type}?`,
  `[${type}]`,
  `[${type}]?`,
  `[${type}?]`,
  `[${type}?]?`,
];
