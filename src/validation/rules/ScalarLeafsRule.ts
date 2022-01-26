import { inspect } from '../../jsutils/inspect';

import type { FieldNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { getNamedType, isDataType } from '../../type/definition';

import { GraphQLError } from '../../error';

import type { ValidationContext } from '../ValidationContext';

/**
 * Scalar leafs
 *
 * A GraphQL document is valid only if all leaf fields are of scalar or data types.
 */
export function ScalarLeafsRule(context: ValidationContext): ASTVisitor {
  return {
    Field(node: FieldNode) {
      const type = context.getType();
      const selectionSet = node.selectionSet;
      if (type) {
        if (isDataType(getNamedType(type))) {
          if (selectionSet) {
            const fieldName = node.name.value;
            const typeStr = inspect(type);
            context.reportError(
              new GraphQLError(
                `Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`,
                selectionSet,
              ),
            );
          }
        } else if (!selectionSet) {
          const fieldName = node.name.value;
          const typeStr = inspect(type);
          context.reportError(
            new GraphQLError(
              `Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`,
              node,
            ),
          );
        }
      }
    },
  };
}
