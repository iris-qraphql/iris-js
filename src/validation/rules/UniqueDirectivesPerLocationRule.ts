import { irisError } from '../../error';
import { isTypeDefinitionNode } from '../../types/ast';
import { specifiedDirectives } from '../../types/directives';
import { IrisKind } from '../../types/kinds';
import type { ASTVisitor } from '../../utils/visitor';

import type { IrisValidationContext } from '../ValidationContext';

/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all non-repeatable directives at
 * a given location are uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Unique-Per-Location
 */
export function UniqueDirectivesPerLocationRule(
  context: IrisValidationContext,
): ASTVisitor {
  const uniqueDirectiveMap = Object.create(null);

  for (const directive of specifiedDirectives) {
    uniqueDirectiveMap[directive.name] = true;
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === IrisKind.DIRECTIVE_DEFINITION) {
      uniqueDirectiveMap[def.name.value] = !def.repeatable;
    }
  }

  const typeDirectivesMap = Object.create(null);

  return {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    enter(node) {
      if (!('directives' in node) || !node.directives) {
        return;
      }

      let seenDirectives;
      if (isTypeDefinitionNode(node)) {
        const typeName = node.name.value;
        seenDirectives = typeDirectivesMap[typeName];
        if (seenDirectives === undefined) {
          typeDirectivesMap[typeName] = seenDirectives = Object.create(null);
        }
      } else {
        seenDirectives = Object.create(null);
      }

      for (const directive of node.directives) {
        const directiveName = directive.name.value;

        if (uniqueDirectiveMap[directiveName]) {
          if (seenDirectives[directiveName]) {
            context.reportError(
              irisError(
                `The directive "@${directiveName}" can only be used once at this location.`,
                { nodes: [seenDirectives[directiveName], directive] },
              ),
            );
          } else {
            seenDirectives[directiveName] = directive;
          }
        }
      }
    },
  };
}
