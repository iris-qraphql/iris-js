import type { ASTVisitor } from '../../language/visitor';

import { irisError } from '../../error';
import { print } from '../../printing/printer';
import type { ArgumentDefinitionNode } from '../../types/ast';
import type { IrisArgument } from '../../types/definition';
import { isRequiredArgument, isType } from '../../types/definition';
import { specifiedDirectives } from '../../types/directives';
import { IrisKind } from '../../types/kinds';
import { inspect } from '../../utils/legacy';
import type { ObjMap } from '../../utils/ObjMap';
import { keyMap } from '../../utils/ObjMap';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * @internal
 */
export function ProvidedRequiredArgumentsOnDirectivesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const requiredArgsMap: ObjMap<ObjMap<IrisArgument | ArgumentDefinitionNode>> =
    Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema?.directives ?? specifiedDirectives;
  for (const directive of definedDirectives) {
    requiredArgsMap[directive.name] = keyMap(
      directive.args.filter(isRequiredArgument),
      (arg) => arg.name,
    );
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === IrisKind.DIRECTIVE_DEFINITION) {
      const argNodes = def.arguments ?? [];

      requiredArgsMap[def.name.value] = keyMap(
        argNodes.filter(isRequiredArgumentNode),
        (arg) => arg.name.value,
      );
    }
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
              const argType = isType(argDef.type)
                ? inspect(argDef.type)
                : print(argDef.type);
              context.reportError(
                irisError(
                  `Directive "@${directiveName}" argument "${argName}" of type "${argType}" is required, but it was not provided.`,
                  { node: directiveNode },
                ),
              );
            }
          }
        }
      },
    },
  };
}

function isRequiredArgumentNode(arg: ArgumentDefinitionNode): boolean {
  return arg.type.kind !== IrisKind.MAYBE_TYPE && arg.defaultValue == null;
}
