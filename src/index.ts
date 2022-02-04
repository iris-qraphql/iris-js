/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */

// The Iris.js version info.
import type { GraphQLArgs } from 'graphql';
import { graphql } from 'graphql';
import type { ExecutionResult } from 'graphql/execution';

import type { IrisSchema } from './type/schema';
import { validateSchema } from './type/validate';

import { toGQLSchema } from './transpile/toGQLSchema';

export { version, versionInfo } from './version';

export {
  IrisSchema,
  GraphQLDirective,
  IrisFloat,
  IrisString,
  IrisBool,
  specifiedDirectives,
  GraphQLDeprecatedDirective,
  isSchema,
  isDirective,
  isType,
  isInputType,
  isDataType,
  isResolverType,
  isRequiredArgument,
  isSpecifiedScalarType,
  isSpecifiedDirective,
  assertDirective,
  getNamedType,
  validateSchema,
  IrisResolverType,
} from './type/index';

export type {
  IrisNamedType,
  GraphQLSchemaConfig,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
} from './type/index';

export {
  // Print source location.
  // Lex
  // Parse
  parse,
  parseValue,
  parseConstValue,
  parseType,
  // Print
  print,
  // Visit
  visit,
  visitInParallel,
  getVisitFn,
  getEnterLeaveForKind,
  DirectiveLocation,
  // Predicates
  isValueNode,
  isConstValueNode,
  isTypeSystemDefinitionNode,
  isTypeDefinitionNode,
} from './language/index';

export type {
  SourceLocation,
  DirectiveLocationEnum,
  // Visitor utilities
  ASTVisitor,
  ASTVisitorKeyMap,
  // AST nodes
  ASTNode,
  // Each kind of AST node
  NameNode,
  DocumentNode,
  DefinitionNode,
  VariableNode,
  ArgumentNode,
  ConstArgumentNode,
  ValueNode,
  ConstValueNode,
  FloatValueNode,
  StringValueNode,
  BooleanValueNode,
  NullValueNode,
  EnumValueNode,
  ListValueNode,
  ConstListValueNode,
  ObjectValueNode,
  ConstObjectValueNode,
  ObjectFieldNode,
  ConstObjectFieldNode,
  DirectiveNode,
  ConstDirectiveNode,
  TypeNode,
  NamedTypeNode,
  ListTypeNode,
  TypeSystemDefinitionNode,
  TypeDefinitionNode,
  FieldDefinitionNode,
  ArgumentDefinitionNode,
  ResolverTypeDefinitionNode,
  DirectiveDefinitionNode,
} from './language/index';

export type IrisArgs = Omit<GraphQLArgs, 'schema'> & {
  schema: IrisSchema;
};

export const iris = ({
  schema,
  ...args
}: IrisArgs): Promise<ExecutionResult> => {
  const errors = validateSchema(schema);

  if (errors.length > 0) {
    return Promise.resolve({ errors });
  }

  return graphql({ schema: toGQLSchema(schema), ...args });
};
