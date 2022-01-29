import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
  Source,
} from 'graphql';
import type { ExecutionResult } from 'graphql/execution';
import { execute } from 'graphql/execution';

import { devAssert } from './jsutils/devAssert';
import type { Maybe } from './jsutils/Maybe';

import { parse } from './language/parser';

import type { GraphQLSchema } from './type/schema';
import { validateSchema } from './type/validate';

import { validate } from './validation/validate';

export interface GraphQLArgs {
  schema: GraphQLSchema;
  source: string | Source;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<Readonly<Record<string, unknown>>>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
}

export function graphql(args: GraphQLArgs): Promise<ExecutionResult> {
  // Always return a Promise for a consistent API.
  return new Promise((resolve) => resolve(graphqlImpl(args)));
}

type PromiseOrValue<T> = Promise<T> | T;

function graphqlImpl(args: GraphQLArgs): PromiseOrValue<ExecutionResult> {
  // Temporary for v15 to v16 migration. Remove in v17
  devAssert(
    arguments.length < 2,
    'graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead.',
  );

  const {
    schema,
    source,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;

  // Validate Schema
  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    return { errors: schemaValidationErrors };
  }

  // Parse
  let document;
  try {
    document = parse(source);
  } catch (syntaxError) {
    return { errors: [syntaxError] };
  }

  // Validate
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return { errors: validationErrors };
  }

  // Execute
  return execute({
    // @ts-expect-error
    schema,
    // @ts-expect-error
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
