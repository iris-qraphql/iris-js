export {
  // Predicate
  isSchema,
  // Assertion
  // GraphQL Schema definition
  IrisSchema,
} from './schema';
export type { GraphQLSchemaConfig } from './schema';

export {
  isType,
  isInputType,
  isDataType,
  isResolverType,
  IrisResolverType,
  isRequiredArgument,
  getNamedType,
} from './definition';

export type {
  IrisType,
  IrisStrictType as GraphQLInputType,

  IrisNamedType ,
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
  IrisFloat,
  IrisString,
  IrisBool,
} from './scalars';

// Validate GraphQL schema.
export { validateSchema } from './validate';
