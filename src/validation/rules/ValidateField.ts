import { getRefTypeName, isTypeDefinitionNode } from '../../types/ast';
import type { ASTVisitor } from '../../utils/visitor';

import type { IrisValidationContext } from '../ValidationContext';

export function ValidateField(ctx: IrisValidationContext): ASTVisitor {
  const doc = ctx.getDocument().definitions;

  return {
    TypeDefinition(type) {
      for (const variant of type.variants) {
        for (const field of variant.fields ?? []) {
          const refTypeName = getRefTypeName(field.type).value;
          const fieldType = doc.find((x) => x.name.value === refTypeName);
          if (!fieldType || !isTypeDefinitionNode(fieldType)) {
            return undefined;
          }
        }
      }

      return false;
    },
  };
}
