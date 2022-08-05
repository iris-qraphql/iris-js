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

    DirectiveDefinition(directive) {
      // const directiveName = directive.name.value;
      for (const arg of directive.arguments ?? []) {
        // const argName = arg.name.value;
        const argTypeName = getRefTypeName(arg.type).value;
        const argType = doc.find((x) => x.name.value === argTypeName);

        if (!argType || !isTypeDefinitionNode(argType)) {
          return undefined;
        }

        // TODO:
        // if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        //   context.reportError(
        //     `Required argument @${directive.name}(${arg.name}:) cannot be deprecated.`,
        //     [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        //   );
        // }
      }
      return undefined;
    },
  };
}
