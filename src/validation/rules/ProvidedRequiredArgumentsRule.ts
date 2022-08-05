import { irisError } from '../../error';
import type { ArgumentDefinitionNode } from '../../types/ast';
import { isRequiredArgument ,specifiedDirectives} from '../../types/ast';
import { inspect } from '../../utils/legacy';
import type { ObjMap } from '../../utils/ObjMap';
import { keyMap } from '../../utils/ObjMap';
import type { ASTVisitor } from '../../utils/visitor';

import type { IrisValidationContext } from '../ValidationContext';

/**
 * @internal
 */
export function ProvidedRequiredArgumentsOnDirectivesRule(
  context: IrisValidationContext,
): ASTVisitor {
  const requiredArgsMap: ObjMap<ObjMap<ArgumentDefinitionNode>> = {};

  for (const directive of specifiedDirectives) {
    requiredArgsMap[directive.name] = keyMap(
      directive.args.filter(isRequiredArgument),
      (arg) => arg.name.value,
    );
  }

  return {
    Directive: {
      // Validate on leave to allow for deeper errors to appear first.
      leave(directiveNode) {
        const directiveName = directiveNode.name.value;
        const requiredArgs = requiredArgsMap[directiveName];
        if (requiredArgs) {
          const argNodes = directiveNode.arguments ?? [];
          const argNodeMap = new Set(argNodes.map((arg) => arg.name.value));
          for (const [argName, argDef] of Object.entries(requiredArgs)) {
            if (!argNodeMap.has(argName)) {
              const argType = inspect(argDef.type);
              context.reportError(
                irisError(
                  `Directive "@${directiveName}" argument "${argName}" of type "${argType}" is required, but it was not provided.`,
                  { nodes: directiveNode },
                ),
              );
            }
          }
        }
      },
    },
  };
}

