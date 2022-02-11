import type { TypeDefinitionNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';
import { getDuplicates } from '../../utils/duplicates';

import type { SDLValidationContext } from '../ValidationContext';

export function UniqueVariantAndFieldDefinitionNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  return {
    TypeDefinition: (type: TypeDefinitionNode) => {
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
