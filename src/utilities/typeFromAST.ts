import type { ListTypeNode, NamedTypeNode, TypeNode } from '../language/ast';
import { IrisKind } from '../language/kinds';

import type { GraphQLType,IrisNamedType } from '../type/definition';
import { IrisTypeRef } from '../type/definition';
import type { GraphQLSchema } from '../type/schema';

/**
 * Given a Schema and an AST node describing a type, return a GraphQLType
 * definition which applies to that type. For example, if provided the parsed
 * AST node for `[User]`, a GraphQLList instance will be returned, containing
 * the type called "User" found in the schema. If a type called "User" is not
 * found in the schema, then undefined will be returned.
 */
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: NamedTypeNode,
): IrisNamedType | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: ListTypeNode,
): IrisTypeRef<any> | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode,
): GraphQLType | undefined;
export function typeFromAST(
  schema: GraphQLSchema,
  typeNode: TypeNode,
): GraphQLType | undefined {
  switch (typeNode.kind) {
    case IrisKind.LIST_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new IrisTypeRef('LIST', innerType);
    }
    case IrisKind.NON_NULL_TYPE: {
      const innerType = typeFromAST(schema, typeNode.type);
      return innerType && new IrisTypeRef('REQUIRED', innerType);
    }
    case IrisKind.NAMED_TYPE:
      return schema.getType(typeNode.name.value);
  }
}
