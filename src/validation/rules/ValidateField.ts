import { irisNodeError } from '../../error';
import { getRefTypeName, isTypeDefinitionNode } from '../../types/ast';
import type { ASTVisitor } from '../../types/visitor';

import type { SDLValidationContext } from '../ValidationContext';

export function ValidateField(ctx: SDLValidationContext): ASTVisitor {
  const doc = ctx.getDocument().definitions;

  return {
    TypeDefinition(type) {
      for (const variant of type.variants) {
        for (const field of variant.fields ?? []) {
          const refTypeName = getRefTypeName(field.type).value;
          const fieldType = doc.find((x) => x.name.value === refTypeName);
          const fieldPath = `${variant.name.value}.${field.name.value}`;

          if (!fieldType || !isTypeDefinitionNode(fieldType)) {
            return undefined;
          }

          if (type.role === 'data' && fieldType.role === 'resolver') {
            ctx.reportError(
              irisNodeError(
                `The type of ${fieldPath} must be data Type but got: ${refTypeName}.`,
                field,
              ),
            );
          }

          for (const arg of field.arguments ?? []) {
            const argName = arg.name.value;
            const argTypeName = getRefTypeName(arg.type).value;
            const argType = doc.find((x) => x.name.value === argTypeName);

            if (!argType || !isTypeDefinitionNode(argType)) {
              return undefined;
            }

            if (argType.role === 'resolver') {
              ctx.reportError(
                irisNodeError(
                  `The type of ${fieldPath}(${argName}:) must be Input Type but got: ${argTypeName}.`,
                  arg,
                ),
              );
            }

            // TODO:
            //   if (isRequiredArgument(arg) && arg.deprecationReason != null) {
            //     ctx.reportError(
            //       `Required argument ${variantName}.${field.name}(${argName}:) cannot be deprecated.`,
            //       [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
            //     );
            //   }
          }
        }
      }

      return false;
    },

    DirectiveDefinition(directive) {
      const directiveName = directive.name.value;
      for (const arg of directive.arguments ?? []) {
        const argName = arg.name.value;
        const argTypeName = getRefTypeName(arg.type).value;
        const argType = doc.find((x) => x.name.value === argTypeName);

        if (!argType || !isTypeDefinitionNode(argType)) {
          return undefined;
        }

        if (argType.role === 'resolver') {
          ctx.reportError(
            irisNodeError(
              `The type of @${directiveName}(${argName}:) must be data Type but got: ${argTypeName}.`,
              arg,
            ),
          );
        }
        // TODO:
        // if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        //   context.reportError(
        //     `Required argument @${directive.name}(${arg.name}:) cannot be deprecated.`,
        //     [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        //   );
        // }
      }
    },
  };
}
