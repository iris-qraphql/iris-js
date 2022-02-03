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
  const schema = context.getSchema();

  return {
    ResolverTypeDefinition: checkTypeName,
    DataTypeDefinition: checkTypeName,
  };

  function checkTypeName(node: TypeDefinitionNode) {
    const typeName = node.name.value;

    if (schema?.getType(typeName)) {
      context.reportError(
        irisNodeError(
          `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`,
          node.name,
        ),
      );
      return;
    }

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
