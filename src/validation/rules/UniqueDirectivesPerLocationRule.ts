import { IrisKind } from '../../language/kinds';
import { isTypeDefinitionNode } from '../../language/predicates';
import type { ASTVisitor } from '../../language/visitor';

import { specifiedDirectives } from '../../type/directives';

import { irisError } from '../../error';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext';

/**
 * Unique directive names per location
 *
 * A GraphQL document is only valid if all non-repeatable directives at
 * a given location are uniquely named.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Unique-Per-Location
 */
export function UniqueDirectivesPerLocationRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const uniqueDirectiveMap = Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema ? schema.directives : specifiedDirectives;
  for (const directive of definedDirectives) {
    uniqueDirectiveMap[directive.name] = !directive.isRepeatable;
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
                { node: [seenDirectives[directiveName], directive] },
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
