import type { DocumentNode } from '../language/ast';
import { visit, visitInParallel } from '../language/visitor';

import type { IrisError } from '../error';
import type { IrisSchema } from '../types/schema';
import type { Maybe } from '../utils/type-level';

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
): ReadonlyArray<IrisError> {
  const errors: Array<IrisError> = [];
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
