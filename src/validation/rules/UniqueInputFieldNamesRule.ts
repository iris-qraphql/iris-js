import { irisError } from '../../error';
import type { NameNode } from '../../types/ast';
import type { ASTVisitor } from '../../types/visitor';
import { invariant } from '../../utils/legacy';
import type { ObjMap } from '../../utils/ObjMap';

import type { IrisValidationContext } from '../ValidationContext';

/**
 * Unique input field names
 *
 * A GraphQL input object value is only valid if all supplied fields are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 */
export function UniqueInputFieldNamesRule(
  context: IrisValidationContext,
): ASTVisitor {
  const knownNameStack: Array<ObjMap<NameNode>> = [];
  let knownNames: ObjMap<NameNode> = Object.create(null);

  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = Object.create(null);
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        invariant(prevKnownNames);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      if (knownNames[fieldName]) {
        context.reportError(
          irisError(`There can be only one input field named "${fieldName}".`, {
            node: [knownNames[fieldName], node.name],
          }),
        );
      } else {
        knownNames[fieldName] = node.name;
      }
    },
  };
}
