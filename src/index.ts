/**
 * GraphQL.js provides a reference implementation for the GraphQL specification
 * but is also a useful utility for operating on GraphQL files and building
 * sophisticated tools.
 *
 * This primary module exports a general purpose function for fulfilling all
 * steps of the GraphQL specification in a single operation, but also includes
 * utilities for every part of the GraphQL specification:
 *
 *   - Parsing the GraphQL language.
 *   - Building a GraphQL type schema.
 *   - Validating a GraphQL request against a type schema.
 *   - Executing a GraphQL request against a type schema.
 *
 * This also includes utility functions for operating on GraphQL types and
 * GraphQL documents to facilitate building tools.
 *
 * You may also import from each sub-directory directly. For example, the
 * following two import statements are equivalent:
 *
 * ```ts
 * import { parse } from 'iris';
 * import { parse } from 'iris/language';
 * ```
 *
 * @packageDocumentation
 */

// The GraphQL.js version info.
export { version, versionInfo } from './version';
export { graphql } from './iris';

export {
  GraphQLSchema,
  GraphQLDirective,
  specifiedScalarTypes,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
  GRAPHQL_MAX_INT,
  GRAPHQL_MIN_INT,
  specifiedDirectives,
  GraphQLDeprecatedDirective,
  isSchema,
  isDirective,
  isType,
  isNonNullType,
  isInputType,
  isOutputType,
  isDataType,
  isResolverType,
  isRequiredArgument,
  isSpecifiedScalarType,
  isSpecifiedDirective,
  assertSchema,
  assertDirective,
  getNamedType,
  validateSchema,
  assertValidSchema,
  assertName,
  assertEnumValueName,
} from './type/index';

export type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  IrisResolverType,
  GraphQLNamedType,
  GraphQLSchemaConfig,
  GraphQLSchemaExtensions,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
  GraphQLArgument,
  GraphQLField,
} from './type/index';

export {
  // Print source location.
  // Lex
  Lexer,
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
  isTypeNode,
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
  NonNullTypeNode,
  TypeSystemDefinitionNode,
  TypeDefinitionNode,
  FieldDefinitionNode,
  ArgumentDefinitionNode,
  ResolverTypeDefinitionNode,
  DirectiveDefinitionNode,
} from './language/index';

// Create, format, and print GraphQL errors.

// Utilities for operating on GraphQL type schema and parsed sources.
export {
  // Produce the GraphQL query recommended for a full schema introspection.
  // Accepts optional IntrospectionOptions.
  // Build a GraphQLSchema from an introspection result.
  // Build a GraphQLSchema from a parsed GraphQL Schema language AST.
  buildASTSchema,
  // Build a GraphQLSchema from a GraphQL schema language document.
  buildSchema,
  // Print a GraphQLSchema to GraphQL Schema language.
  printSchema,
  // Print a GraphQLType to GraphQL Schema language.
  printType,
  // Prints the built-in introspection schema in the Schema Language format.
  // Create a GraphQLType from a GraphQL language AST.
  typeFromAST,
  // Create a JavaScript value from a GraphQL language AST with a Type.
  // Create a JavaScript value from a GraphQL language AST without a Type.
  // Create a GraphQL language AST from a JavaScript value.
  astFromValue,
  // A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
  TypeInfo, // Comparators for types
} from './utilities/index';

export type { BuildSchemaOptions } from './utilities/index';
