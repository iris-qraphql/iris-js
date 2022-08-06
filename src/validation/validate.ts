import type { IrisError } from '../error';
import type { DocumentNode } from '../types/ast';
import { visit, visitInParallel } from '../utils/visitor';

import { IncludeOnlyVariantTypes } from './rules/IncludeOnlyVariantTypes';
import { KnownArgumentNamesOnDirectivesRule } from './rules/KnownArgumentNamesRule';
import { KnownDirectivesRule } from './rules/KnownDirectivesRule';
import { KnownTypeNamesRule } from './rules/KnownTypeNamesRule';
import { ProvidedRequiredArgumentsOnDirectivesRule } from './rules/ProvidedRequiredArgumentsRule';
import { UniqueDirectivesPerLocationRule } from './rules/UniqueDirectivesPerLocationRule';
import { UniqueNamesRule } from './rules/UniqueNamesRule';
import { ValidateField } from './rules/ValidateField';
import type { SDLValidationRule } from './ValidationContext';
import { IrisValidationContext } from './ValidationContext';

export const specifiedSDLRules: ReadonlyArray<SDLValidationRule> =
  Object.freeze([
    UniqueNamesRule,
    KnownTypeNamesRule,
    KnownDirectivesRule,
    UniqueDirectivesPerLocationRule,
    KnownArgumentNamesOnDirectivesRule,
    ProvidedRequiredArgumentsOnDirectivesRule,
    // IRIS
    IncludeOnlyVariantTypes,
    ValidateField,
  ]);

/**
 * @internal
 */
export function validateSDL(
  documentAST: DocumentNode,
  rules: ReadonlyArray<SDLValidationRule> = specifiedSDLRules,
): ReadonlyArray<IrisError> {
  const context = new IrisValidationContext(documentAST);

  const visitors = rules.map((rule) => rule(context));
  visit(documentAST, visitInParallel(visitors));
  return context.errors;
}
