import type { ASTNode } from '../../language/ast';
import {
  isTypeDefinitionNode,
  isTypeSystemDefinitionNode,
} from '../../language/predicates';
import type { ASTVisitor } from '../../language/visitor';

import { specifiedScalarTypes } from '../../type/scalars';

import { irisNodeError } from '../../error';
import { didYouMean, suggestionList } from '../../utils/legacy';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext';

/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
 */
export function KnownTypeNamesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingTypesMap = schema ? schema.typeMap : Object.create(null);

  const definedTypes = Object.create(null);
  for (const def of context.getDocument().definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes[def.name.value] = true;
    }
  }

  const typeNames = [
    ...Object.keys(existingTypesMap),
    ...Object.keys(definedTypes),
  ];

  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && standardTypeNames.includes(typeName)) {
          return;
        }

        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? standardTypeNames.concat(typeNames) : typeNames,
        );
        context.reportError(
          irisNodeError(
            `Unknown type "${typeName}".` + didYouMean(suggestedTypes),
            node,
          ),
        );
      }
    },
    VariantDefinition(node, _1, parent, _2, ancestors) {
      if (node.fields) {
        return undefined;
      }

      const typeName = node.name.value;
      if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && standardTypeNames.includes(typeName)) {
          return;
        }

        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? standardTypeNames.concat(typeNames) : typeNames,
        );
        context.reportError(
          irisNodeError(
            `Unknown type "${typeName}".` + didYouMean(suggestedTypes),
            node,
          ),
        );
      }
    },
  };
}

const standardTypeNames = [...specifiedScalarTypes].map((type) => type.name);

function isSDLNode(value: ASTNode | ReadonlyArray<ASTNode>): boolean {
  return 'kind' in value && isTypeSystemDefinitionNode(value);
}
