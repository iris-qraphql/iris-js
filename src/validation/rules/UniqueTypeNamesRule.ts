import type { TypeDefinitionNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique type names
 *
 * A GraphQL document is only valid if all defined types have unique names.
 */
export function UniqueTypeNamesRule(context: SDLValidationContext): ASTVisitor {
  const knownTypeNames = Object.create(null);

  return {
    TypeDefinition: checkTypeName,
  };

  function checkTypeName(node: TypeDefinitionNode) {
    const typeName = node.name.value;

    if (knownTypeNames[typeName]) {
      context.reportError(
        irisNodeError(`There can be only one type named "${typeName}".`, [
          knownTypeNames[typeName],
          node.name,
        ]),
      );
    } else {
      knownTypeNames[typeName] = node.name;
    }

    return false;
  }
}
