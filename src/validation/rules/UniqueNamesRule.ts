import type { TypeDefinitionNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';
import { getDuplicates } from '../../utils/duplicates';

import type { SDLValidationContext } from '../ValidationContext';

export function UniqueNamesRule(context: SDLValidationContext): ASTVisitor {
  const knownTypeNames = Object.create(null);

  return {
    TypeDefinition(type: TypeDefinitionNode) {
      const typeName = type.name.value;

      if (knownTypeNames[typeName]) {
        context.reportError(
          irisNodeError(`There can be only one type named "${typeName}".`, [
            knownTypeNames[typeName],
            type.name,
          ]),
        );
      } else {
        knownTypeNames[typeName] = type.name;
      }

      getDuplicates(type.variants).forEach(([name, node]) =>
        context.reportError(
          irisNodeError(
            `Variant "${type.name.value}.${node.name.value}" can only be defined once.`,
            [name, node.name],
          ),
        ),
      );

      type.variants.forEach((variant) =>
        getDuplicates(variant.fields ?? []).forEach(([name, node]) =>
          context.reportError(
            irisNodeError(
              `Field "${variant.name.value}.${node.name.value}" can only be defined once.`,
              [name, node.name],
            ),
          ),
        ),
      );

      return false;
    },
  };
}
