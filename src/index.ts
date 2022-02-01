/**
 * Iris.js provides a reference implementation for the Iris.
 *
 * @packageDocumentation
 */

// The Iris.js version info.
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

export {
  buildSchema,
  printSchema,
  printType,
  astFromValue,
  TypeInfo,
} from './utilities/index';
