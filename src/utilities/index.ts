// Gets the Type for the target Operation AST.

// Build a GraphQLSchema from GraphQL Schema language.
export { buildASTSchema, buildSchema } from './buildASTSchema';
export type { BuildSchemaOptions } from './buildASTSchema';

// Print a GraphQLSchema to GraphQL Schema language.
export { printSchema, printType } from './printSchema';

// Create a GraphQLType from a GraphQL language AST.
export { typeFromAST } from './typeFromAST';

// Create a JavaScript value from a GraphQL language AST with a type.
export { valueFromAST } from './valueFromAST';

// Create a GraphQL language AST from a JavaScript value.
export { astFromValue } from './astFromValue';

// A helper to use within recursive-descent visitors which need to be aware of the GraphQL type system.
export { TypeInfo } from './TypeInfo';

// Comparators for types
export { isEqualType, isTypeSubTypeOf } from './typeComparators';
