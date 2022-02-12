import type { IrisError } from '../error';
import type { DocumentNode } from '../types/ast';
import type { IrisSchema } from '../types/schema';
import { visit, visitInParallel } from '../types/visitor';
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
