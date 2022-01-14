import { forEachObjIndexed, groupBy } from 'ramda';

import type { ArgumentNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { irisError } from '../../error';

import type { ASTValidationContext } from '../ValidationContext';

/**
 * Unique argument names
 *
 * A GraphQL field or directive is only valid if all supplied arguments are
 * uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 */
export function UniqueArgumentNamesRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    Directive: checkArgUniqueness,
  };

  function checkArgUniqueness(parentNode: {
    arguments?: ReadonlyArray<ArgumentNode>;
  }) {
    const argumentNodes = parentNode.arguments ?? [];

    const seenArgs = groupBy((arg) => arg.name.value, argumentNodes);

    forEachObjIndexed((argNodes, argName) => {
      if (argNodes.length > 1) {
        context.reportError(
          irisError(`There can be only one argument named "${argName}".`, {
            node: argNodes.map((node) => node.name),
          }),
        );
      }
    }, seenArgs);
  }
}
