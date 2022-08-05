import { irisError } from '../../error';
import { specifiedDirectives } from '../../types/ast';
import { didYouMean, suggestionList } from '../../utils/legacy';
import type { ASTVisitor } from '../../utils/visitor';

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
    directiveArgs[directive.name] = directive.args.map((arg) => arg.name.value);
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
