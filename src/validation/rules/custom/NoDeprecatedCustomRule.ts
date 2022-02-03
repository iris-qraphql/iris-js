import type { ASTVisitor } from '../../../language/visitor';

import { getNamedType, isDataType } from '../../../type/definition';

import { irisError } from '../../../error';
import { invariant } from '../../../utils/legacy';

import type { ValidationContext } from '../../ValidationContext';

/**
 * No deprecated
 *
 * A GraphQL document is only valid if all selected fields and all used data values have not been
 * deprecated.
 *
 * Note: This rule is optional and is not part of the Validation section of the GraphQL
 * Specification. The main purpose of this rule is detection of deprecated usages and not
 * necessarily to forbid their use when querying a service.
 */
export function NoDeprecatedCustomRule(context: ValidationContext): ASTVisitor {
  return {
    Argument(node) {
      const argDef = context.getArgument();
      const deprecationReason = argDef?.deprecationReason;
      if (argDef && deprecationReason != null) {
        const directiveDef = context.getDirective();
        if (directiveDef != null) {
          context.reportError(
            irisError(
              `Directive "@${directiveDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
              { node },
            ),
          );
        } else {
          const parentType = context.getParentType();
          const fieldDef = context.getFieldDef();
          invariant(parentType != null && fieldDef != null);
          context.reportError(
            irisError(
              `Field "${parentType.name}.${fieldDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
              { node },
            ),
          );
        }
      }
    },
    ObjectField(node) {
      const def = getNamedType(context.getParentInputType());
      if (isDataType(def) && def.isVariantType()) {
        const inputFieldDef = def.variantBy().fields?.[node.name.value];
        const deprecationReason = inputFieldDef?.deprecationReason;
        if (deprecationReason != null) {
          context.reportError(
            irisError(
              `The input field ${def.name}.${inputFieldDef?.name} is deprecated. ${deprecationReason}`,
              { node },
            ),
          );
        }
      }
    },
    EnumValue(node) {
      const enumValueDef = context.getEnumValue();
      const deprecationReason = enumValueDef?.deprecationReason;
      if (enumValueDef && deprecationReason != null) {
        const enumTypeDef = getNamedType(context.getInputType());
        invariant(enumTypeDef != null);
        context.reportError(
          irisError(
            `The Variant "${enumTypeDef.name}.${enumValueDef.name}" is deprecated. ${deprecationReason}`,
            { node },
          ),
        );
      }
    },
  };
}
