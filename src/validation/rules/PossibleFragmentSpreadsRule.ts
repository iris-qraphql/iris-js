import { inspect } from '../../jsutils/inspect';
import type { Maybe } from '../../jsutils/Maybe';

import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';

import type { IrisResolverType } from '../../type/definition';
import { isResolverType } from '../../type/definition';

import { doTypesOverlap } from '../../utilities/typeComparators';
import { typeFromAST } from '../../utilities/typeFromAST';

import type { ValidationContext } from '../ValidationContext';

/**
 * Possible fragment spread
 *
 * A fragment spread is only valid if the type condition could ever possibly
 * be true: if there is a non-empty intersection of the possible parent types,
 * and possible types which pass the type condition.
 */
export function PossibleFragmentSpreadsRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    InlineFragment(node) {
      const fragType = context.getType();
      const parentType = context.getParentType();
      if (
        isResolverType(fragType) &&
        isResolverType(parentType) &&
        !doTypesOverlap(context.getSchema(), fragType, parentType)
      ) {
        const parentTypeStr = inspect(parentType);
        const fragTypeStr = inspect(fragType);
        context.reportError(
          new GraphQLError(
            `Fragment cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            node,
          ),
        );
      }
    },
    FragmentSpread(node) {
      const fragName = node.name.value;
      const fragType = getFragmentType(context, fragName);
      const parentType = context.getParentType();
      if (
        fragType &&
        parentType &&
        !doTypesOverlap(context.getSchema(), fragType, parentType)
      ) {
        const parentTypeStr = inspect(parentType);
        const fragTypeStr = inspect(fragType);
        context.reportError(
          new GraphQLError(
            `Fragment "${fragName}" cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            node,
          ),
        );
      }
    },
  };
}

function getFragmentType(
  context: ValidationContext,
  name: string,
): Maybe<IrisResolverType> {
  const frag = context.getFragment(name);
  if (frag) {
    const type = typeFromAST(context.getSchema(), frag.typeCondition);
    if (isResolverType(type)) {
      return type;
    }
  }
}
