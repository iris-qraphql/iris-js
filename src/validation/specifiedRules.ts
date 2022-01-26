import { KnownArgumentNamesOnDirectivesRule } from './rules/KnownArgumentNamesRule';
import { KnownDirectivesRule } from './rules/KnownDirectivesRule';
import { KnownTypeNamesRule } from './rules/KnownTypeNamesRule';
import { ProvidedRequiredArgumentsOnDirectivesRule } from './rules/ProvidedRequiredArgumentsRule';
import { UniqueArgumentDefinitionNamesRule } from './rules/UniqueArgumentDefinitionNamesRule';
// Spec Section: "Argument Uniqueness"
import { UniqueArgumentNamesRule } from './rules/UniqueArgumentNamesRule';
import { UniqueDirectiveNamesRule } from './rules/UniqueDirectiveNamesRule';
// Spec Section: "Directives Are Unique Per Location"
import { UniqueDirectivesPerLocationRule } from './rules/UniqueDirectivesPerLocationRule';
import { UniqueInputFieldNamesRule } from './rules/UniqueInputFieldNamesRule';
import { UniqueTypeNamesRule } from './rules/UniqueTypeNamesRule';
import { UniqueVariantAndFieldDefinitionNamesRule } from './rules/UniqueVariantAndFieldDefinitionNamesRule';
import type { SDLValidationRule } from './ValidationContext';

/**
 * @internal
 */
export const specifiedSDLRules: ReadonlyArray<SDLValidationRule> =
  Object.freeze([
    UniqueTypeNamesRule,
    UniqueVariantAndFieldDefinitionNamesRule,
    UniqueArgumentDefinitionNamesRule,
    UniqueDirectiveNamesRule,
    KnownTypeNamesRule,
    KnownDirectivesRule,
    UniqueDirectivesPerLocationRule,
    KnownArgumentNamesOnDirectivesRule,
    UniqueArgumentNamesRule,
    UniqueInputFieldNamesRule,
    ProvidedRequiredArgumentsOnDirectivesRule,
  ]);
