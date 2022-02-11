import { IncludeOnlyVariantTypes } from './rules/IncludeOnlyVariantTypes';
import { KnownArgumentNamesOnDirectivesRule } from './rules/KnownArgumentNamesRule';
import { KnownDirectivesRule } from './rules/KnownDirectivesRule';
import { KnownTypeNamesRule } from './rules/KnownTypeNamesRule';
import { ProvidedRequiredArgumentsOnDirectivesRule } from './rules/ProvidedRequiredArgumentsRule';
import { UniqueArgumentNamesRule } from './rules/UniqueArgumentNamesRule';
import { UniqueDirectiveNamesRule } from './rules/UniqueDirectiveNamesRule';
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
    UniqueDirectiveNamesRule,
    KnownTypeNamesRule,
    KnownDirectivesRule,
    UniqueDirectivesPerLocationRule,
    KnownArgumentNamesOnDirectivesRule,
    UniqueArgumentNamesRule,
    UniqueInputFieldNamesRule,
    ProvidedRequiredArgumentsOnDirectivesRule,
    // IRIS
    IncludeOnlyVariantTypes,
  ]);
