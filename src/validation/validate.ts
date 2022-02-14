import type { IrisError } from '../error';
import type { DocumentNode } from '../types/ast';
import { visit, visitInParallel } from '../types/visitor';

import { IncludeOnlyVariantTypes } from './rules/IncludeOnlyVariantTypes';
import { KnownArgumentNamesOnDirectivesRule } from './rules/KnownArgumentNamesRule';
import { KnownDirectivesRule } from './rules/KnownDirectivesRule';
import { KnownTypeNamesRule } from './rules/KnownTypeNamesRule';
import { ObjectRootTypes } from './rules/ObjectRootTypes';
import { ProvidedRequiredArgumentsOnDirectivesRule } from './rules/ProvidedRequiredArgumentsRule';
import { UniqueDirectivesPerLocationRule } from './rules/UniqueDirectivesPerLocationRule';
import { UniqueInputFieldNamesRule } from './rules/UniqueInputFieldNamesRule';
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
    UniqueInputFieldNamesRule,
    ProvidedRequiredArgumentsOnDirectivesRule,
    // IRIS
    IncludeOnlyVariantTypes,
    ValidateField,
    ObjectRootTypes,
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
