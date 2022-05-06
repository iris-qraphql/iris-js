import { irisError } from '../../error';
import { specifiedDirectives } from '../../types/directives';
import { IrisKind } from '../../types/kinds';
import type { ASTVisitor } from '../../types/visitor';
import { didYouMean, suggestionList } from '../../utils/legacy';

import type { IrisValidationContext } from '../ValidationContext';

/**
 * @internal
 */
export function KnownArgumentNamesOnDirectivesRule(
  context: IrisValidationContext,
): ASTVisitor {
  const directiveArgs = Object.create(null);

  const definedDirectives = specifiedDirectives;
  for (const directive of definedDirectives) {
    directiveArgs[directive.name] = directive.args.map((arg) => arg.name);
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === IrisKind.DIRECTIVE_DEFINITION) {
      const argsNodes = def.arguments ?? [];

      directiveArgs[def.name.value] = argsNodes.map((arg) => arg.name.value);
    }
  }

  return {
    Directive(directiveNode) {
      const directiveName = directiveNode.name.value;
      const knownArgs = directiveArgs[directiveName];

      if (directiveNode.arguments && knownArgs) {
        for (const argNode of directiveNode.arguments) {
          const argName = argNode.name.value;
          if (!knownArgs.includes(argName)) {
            const suggestions = suggestionList(argName, knownArgs);
            context.reportError(
              irisError(
                `Unknown argument "${argName}" on directive "@${directiveName}".` +
                  didYouMean(suggestions),
                { nodes: argNode },
              ),
            );
          }
        }
      }

      return false;
    },
  };
}
