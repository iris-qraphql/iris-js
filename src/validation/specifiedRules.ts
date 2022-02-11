import { IncludeOnlyVariantTypes } from './rules/IncludeOnlyVariantTypes';
import { KnownArgumentNamesOnDirectivesRule } from './rules/KnownArgumentNamesRule';
import { KnownDirectivesRule } from './rules/KnownDirectivesRule';
import { KnownTypeNamesRule } from './rules/KnownTypeNamesRule';
import { ProvidedRequiredArgumentsOnDirectivesRule } from './rules/ProvidedRequiredArgumentsRule';
import { UniqueDirectivesPerLocationRule } from './rules/UniqueDirectivesPerLocationRule';
import { UniqueInputFieldNamesRule } from './rules/UniqueInputFieldNamesRule';
import { UniqueNamesRule } from './rules/UniqueNamesRule';
import type { SDLValidationRule } from './ValidationContext';

/**
 * @internal
 */
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
  ]);
