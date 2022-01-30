import type { Maybe } from '../jsutils/Maybe';

import type { DocumentNode } from '../language/ast';
import { visit, visitInParallel } from '../language/visitor';

import type { IrisSchema } from '../type/schema';

import type { GraphQLError } from '../error';

import { specifiedSDLRules } from './specifiedRules';
import type { SDLValidationRule } from './ValidationContext';
import { SDLValidationContext } from './ValidationContext';

/**
 * @internal
 */
export function validateSDL(
  documentAST: DocumentNode,
  schemaToExtend?: Maybe<IrisSchema>,
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
