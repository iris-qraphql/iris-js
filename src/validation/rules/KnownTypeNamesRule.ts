import { irisNodeError } from '../../error';
import type { ASTNode } from '../../types/ast';
import {
  isTypeDefinitionNode,
  isTypeSystemDefinitionNode,
} from '../../types/ast';
import { scalarNames } from '../../types/definition';
import type { ASTVisitor } from '../../types/visitor';
import { didYouMean, suggestionList } from '../../utils/legacy';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Known type names
 *
 * A GraphQL document is only valid if referenced types (specifically
 * variable definitions and fragment conditions) are defined by the type schema.
 *
 * See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
 */
export function KnownTypeNamesRule(context: SDLValidationContext): ASTVisitor {
  const definedTypes = Object.create(null);
  for (const def of context.getDocument().definitions) {
    if (isTypeDefinitionNode(def)) {
      definedTypes[def.name.value] = true;
    }
  }

  const typeNames = [...Object.keys(definedTypes)];

  return {
    NamedType(node, _1, parent, _2, ancestors) {
      const typeName = node.name.value;
      if (!definedTypes[typeName]) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && scalarNames.includes(typeName)) {
          return;
        }

        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? scalarNames.concat(typeNames) : typeNames,
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
      if (!definedTypes[typeName]) {
        const definitionNode = ancestors[2] ?? parent;
        const isSDL = definitionNode != null && isSDLNode(definitionNode);
        if (isSDL && scalarNames.includes(typeName)) {
          return;
        }

        const suggestedTypes = suggestionList(
          typeName,
          isSDL ? scalarNames.concat(typeNames) : typeNames,
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

function isSDLNode(value: ASTNode | ReadonlyArray<ASTNode>): boolean {
  return 'kind' in value && isTypeSystemDefinitionNode(value);
}
