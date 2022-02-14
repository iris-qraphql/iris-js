import type { IrisError } from '../error';
import type { DocumentNode } from '../types/ast';
import { visit, visitInParallel } from '../types/visitor';

import { specifiedSDLRules } from './specifiedRules';
import type { SDLValidationRule } from './ValidationContext';
import { IrisValidationContext } from './ValidationContext';

/**
 * @internal
 */
export function validateSDL(
  documentAST: DocumentNode,
  rules: ReadonlyArray<SDLValidationRule> = specifiedSDLRules,
): ReadonlyArray<IrisError> {
  const context = new IrisValidationContext(documentAST)

  const visitors = rules.map((rule) => rule(context));
  visit(documentAST, visitInParallel(visitors));
  return context.errors;
}
