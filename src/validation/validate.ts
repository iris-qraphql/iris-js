import { devAssert } from '../jsutils/devAssert';
import type { Maybe } from '../jsutils/Maybe';

import type { DocumentNode } from '../language/ast';
import { visit, visitInParallel } from '../language/visitor';

import type { GraphQLSchema } from '../type/schema';
import { assertValidSchema } from '../type/validate';

import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo';

import { GraphQLError } from '../error';

import { specifiedSDLRules } from './specifiedRules';
import type { SDLValidationRule, ValidationRule } from './ValidationContext';
import { SDLValidationContext, ValidationContext } from './ValidationContext';

export function validate(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  rules: ReadonlyArray<ValidationRule> = [],
  options?: { maxErrors?: number },

  /** @deprecated will be removed in 17.0.0 */
  typeInfo: TypeInfo = new TypeInfo(schema),
): ReadonlyArray<GraphQLError> {
  const maxErrors = options?.maxErrors ?? 100;

  devAssert(documentAST, 'Must provide document.');
  // If the schema used for validation is invalid, throw an error.
  assertValidSchema(schema);

  const abortObj = Object.freeze({});
  const errors: Array<GraphQLError> = [];
  const context = new ValidationContext(
    schema,
    documentAST,
    typeInfo,
    (error) => {
      if (errors.length >= maxErrors) {
        errors.push(
          new GraphQLError(
            'Too many validation errors, error limit reached. Validation aborted.',
          ),
        );
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw abortObj;
      }
      errors.push(error);
    },
  );

  // This uses a specialized visitor which runs multiple visitors in parallel,
  // while maintaining the visitor skip and break API.
  const visitor = visitInParallel(rules.map((rule) => rule(context)));

  // Visit the whole document with each instance of all provided rules.
  try {
    visit(documentAST, visitWithTypeInfo(typeInfo, visitor));
  } catch (e) {
    if (e !== abortObj) {
      throw e;
    }
  }
  return errors;
}

/**
 * @internal
 */
export function validateSDL(
  documentAST: DocumentNode,
  schemaToExtend?: Maybe<GraphQLSchema>,
  rules: ReadonlyArray<SDLValidationRule> = specifiedSDLRules,
): ReadonlyArray<GraphQLError> {
  const errors: Array<GraphQLError> = [];
  const context = new SDLValidationContext(
    documentAST,
    schemaToExtend,
    (error) => {
      errors.push(error);
    },
  );

  const visitors = rules.map((rule) => rule(context));
  visit(documentAST, visitInParallel(visitors));
  return errors;
}
