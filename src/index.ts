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
export { iris } from './iris';

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
  assertName,
  assertEnumValueName,
} from './type/index';

export type {
  GraphQLType,
  GraphQLInputType,
  IrisResolverType,
  GraphQLNamedType,
  GraphQLSchemaConfig,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
  GraphQLArgument,
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

export {
  buildSchema,
  printSchema,
  printType,
  astFromValue,
  TypeInfo,
} from './utilities/index';
