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
 * import { parse } from 'graphql';
 * import { parse } from 'graphql/language';
 * ```
 *
 * @packageDocumentation
 */

// The GraphQL.js version info.
export { version, versionInfo } from './version';

// The primary entry point into fulfilling a GraphQL request.
export type { GraphQLArgs } from './iris';
export { graphql, graphqlSync } from './iris';

export {
  GraphQLSchema,
  GraphQLDirective,
  GraphQLScalarType,
  GraphQLList,
  GraphQLNonNull,
  specifiedScalarTypes,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
  GraphQLID,
  GRAPHQL_MAX_INT,
  GRAPHQL_MIN_INT,
  specifiedDirectives,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  GraphQLSpecifiedByDirective,
  TypeKind,
  DEFAULT_DEPRECATION_REASON,
  introspectionTypes,
  __Schema,
  __Directive,
  __DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  __EnumValue,
  __TypeKind,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  isSchema,
  isDirective,
  isType,
  isScalarType,
  isObjectType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isInputType,
  isOutputType,
  isLeafType,
  isCompositeType,
  isAbstractType,
  isWrappingType,
  isNullableType,
  isNamedType,
  isRequiredArgument,
  isRequiredInputField,
  isSpecifiedScalarType,
  isIntrospectionType,
  isSpecifiedDirective,
  assertSchema,
  assertDirective,
  assertScalarType,
  assertObjectType,
  assertResolverType,
  assertListType,
  assertNonNullType,
  assertLeafType,
  assertCompositeType,
  assertAbstractType,
  assertWrappingType,
  assertNamedType,
  getNullableType,
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
  GraphQLLeafType,
  GraphQLCompositeType,
  IrisResolverType,
  GraphQLWrappingType,
  GraphQLNullableType,
  GraphQLNamedType,
  GraphQLNamedInputType,
  GraphQLNamedOutputType,
  ThunkObjMap,
  GraphQLSchemaConfig,
  GraphQLSchemaExtensions,
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
  GraphQLArgument,
  GraphQLArgumentConfig,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFieldMap,
  GraphQLFieldResolver,
  GraphQLInputField,
  GraphQLIsTypeOfFn,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLScalarTypeConfig,
  GraphQLTypeResolver,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLScalarLiteralParser,
} from './type/index';

// Parse and operate on GraphQL language source files.
export {
  Token,
  Source,
  Location,
  OperationTypeNode,
  getLocation,
  // Print source location.
  printLocation,
  printSourceLocation,
  // Lex
  Lexer,
  TokenKind,
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
  BREAK,
  Kind,
  DirectiveLocation,
  // Predicates
  isDefinitionNode,
  isExecutableDefinitionNode,
  isSelectionNode,
  isValueNode,
  isConstValueNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
  isTypeDefinitionNode,
} from './language/index';

export type {
  ParseOptions,
  SourceLocation,
  TokenKindEnum,
  KindEnum,
  DirectiveLocationEnum,
  // Visitor utilities
  ASTVisitor,
  ASTVisitFn,
  ASTVisitorKeyMap,
  // AST nodes
  ASTNode,
  ASTKindToNode,
  // Each kind of AST node
  NameNode,
  DocumentNode,
  DefinitionNode,
  ExecutableDefinitionNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  VariableNode,
  SelectionSetNode,
  SelectionNode,
  FieldNode,
  ArgumentNode,
  ConstArgumentNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
  ValueNode,
  ConstValueNode,
  IntValueNode,
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
  SchemaDefinitionNode,
  OperationTypeDefinitionNode,
  TypeDefinitionNode,
  ScalarTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  ResolverTypeDefinitionNode,
  DirectiveDefinitionNode,
} from './language/index';

// Execute GraphQL queries.
export {
  execute,
  executeSync,
  defaultFieldResolver,
  defaultTypeResolver,
  responsePathAsArray,
  getDirectiveValues,
  subscribe,
  createSourceEventStream,
} from './execution/index';

export type {
  ExecutionArgs,
  ExecutionResult,
  FormattedExecutionResult,
} from './execution/index';

export type { SubscriptionArgs } from './subscription/index';

// Validate GraphQL documents.
export {
  validate,
  ValidationContext,
  // All validation rules in the GraphQL Specification.
  specifiedRules,
  // Individual validation rules.
  ExecutableDefinitionsRule,
  FieldsOnCorrectTypeRule,
  FragmentsOnCompositeTypesRule,
  KnownArgumentNamesRule,
  KnownDirectivesRule,
  KnownFragmentNamesRule,
  KnownTypeNamesRule,
  LoneAnonymousOperationRule,
  NoFragmentCyclesRule,
  NoUndefinedVariablesRule,
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  OverlappingFieldsCanBeMergedRule,
  PossibleFragmentSpreadsRule,
  ProvidedRequiredArgumentsRule,
  ScalarLeafsRule,
  SingleFieldSubscriptionsRule,
  UniqueArgumentNamesRule,
  UniqueDirectivesPerLocationRule,
  UniqueFragmentNamesRule,
  UniqueInputFieldNamesRule,
  UniqueOperationNamesRule,
  UniqueVariableNamesRule,
  ValuesOfCorrectTypeRule,
  VariablesAreInputTypesRule,
  VariablesInAllowedPositionRule,
  // SDL-specific validation rules
  LoneSchemaDefinitionRule,
  UniqueTypeNamesRule,
  UniqueVariantAndFieldDefinitionNamesRule,
  UniqueArgumentDefinitionNamesRule,
  UniqueDirectiveNamesRule,
  // Custom validation rules
  NoDeprecatedCustomRule,
  NoSchemaIntrospectionCustomRule,
} from './validation/index';

export type { ValidationRule } from './validation/index';

// Create, format, and print GraphQL errors.
export {
  GraphQLError,
  syntaxError,
  locatedError,
  printError,
  formatError,
} from './error/index';

export type {
  GraphQLFormattedError,
  GraphQLErrorExtensions,
} from './error/index';

// Utilities for operating on GraphQL type schema and parsed sources.
export {
  // Produce the GraphQL query recommended for a full schema introspection.
  // Accepts optional IntrospectionOptions.
  getIntrospectionQuery,
  // Gets the target Operation from a Document.
  getOperationAST,
  // Gets the Type for the target Operation AST.
  getOperationRootType,
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
  printIntrospectionSchema,
  // Create a GraphQLType from a GraphQL language AST.
  typeFromAST,
  // Create a JavaScript value from a GraphQL language AST with a Type.
  valueFromAST,
  // Create a JavaScript value from a GraphQL language AST without a Type.
  valueFromASTUntyped,
  // Create a GraphQL language AST from a JavaScript value.
  astFromValue,
  // A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
  TypeInfo,
  visitWithTypeInfo,
  // Coerces a JavaScript value to a GraphQL type, or produces errors.
  coerceInputValue,
  // Concatenates multiple AST together.
  concatAST,
  // Separates an AST into an AST per Operation.
  separateOperations,
  // Strips characters that are not significant to the validity or execution of a GraphQL document.
  stripIgnoredCharacters,
  // Comparators for types
  isEqualType,
  isTypeSubTypeOf,
  doTypesOverlap,
  // Asserts a string is a valid GraphQL name.
  assertValidName,
  // Determine if a string is a valid GraphQL name.
  isValidNameError,
} from './utilities/index';

export type {
  IntrospectionOptions,
  IntrospectionQuery,
  IntrospectionSchema,
  IntrospectionType,
  IntrospectionInputType,
  IntrospectionOutputType,
  IntrospectionScalarType,
  IntrospectionObjectType,
  IntrospectionInterfaceType,
  IntrospectionUnionType,
  IntrospectionEnumType,
  IntrospectionInputObjectType,
  IntrospectionTypeRef,
  IntrospectionInputTypeRef,
  IntrospectionOutputTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionEnumValue,
  IntrospectionDirective,
  BuildSchemaOptions,
  TypedQueryDocumentNode,
} from './utilities/index';
