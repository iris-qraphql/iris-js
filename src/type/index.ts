export {
  // Predicate
  isSchema,
  // Assertion
  assertSchema,
  // GraphQL Schema definition
  GraphQLSchema,
} from './schema';
export type { GraphQLSchemaConfig, GraphQLSchemaExtensions } from './schema';

export {
  isType,
  isInputType,
  isDataType,
  isResolverType,
  isRequiredArgument,
  getNamedType,
} from './definition';

export type {
  GraphQLType,
  GraphQLInputType,
  IrisResolverType,
  IrisNamedType as GraphQLNamedType,
  GraphQLArgument,
  IrisDataVariant,
  GraphQLField,
} from './definition';

export {
  // Predicate
  isDirective,
  // Assertion
  assertDirective,
  // Directives Definition
  GraphQLDirective,
  // Built-in Directives defined by the Spec
  isSpecifiedDirective,
  specifiedDirectives,
  GraphQLDeprecatedDirective,
} from './directives';

export type {
  GraphQLDirectiveConfig,
  GraphQLDirectiveExtensions,
} from './directives';

// Common built-in scalar instances.
export {
  // Predicate
  isSpecifiedScalarType,
  // Standard GraphQL Scalars
  specifiedScalarTypes,
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLBoolean,
} from './scalars';

// Validate GraphQL schema.
export { validateSchema, assertValidSchema } from './validate';

// Upholds the spec rules about naming.
export { assertName, assertEnumValueName } from './assertName';
