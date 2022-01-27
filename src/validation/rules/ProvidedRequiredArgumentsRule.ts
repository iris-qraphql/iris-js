import { inspect } from '../../jsutils/inspect';
import { keyMap } from '../../jsutils/keyMap';
import type { ObjMap } from '../../jsutils/ObjMap';

import type { ArgumentDefinitionNode } from '../../language/ast';
import { IrisKind } from '../../language/kinds';
import { print } from '../../language/printer';
import type { ASTVisitor } from '../../language/visitor';

import type { GraphQLArgument } from '../../type/definition';
import { isRequiredArgument, isType } from '../../type/definition';
import { specifiedDirectives } from '../../type/directives';

import { GraphQLError } from '../../error';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext';

/**
 * @internal
 */
export function ProvidedRequiredArgumentsOnDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const requiredArgsMap: ObjMap<
    ObjMap<GraphQLArgument | ArgumentDefinitionNode>
  > = Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema?.getDirectives() ?? specifiedDirectives;
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
                new GraphQLError(
                  `Directive "@${directiveName}" argument "${argName}" of type "${argType}" is required, but it was not provided.`,
                  directiveNode,
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
  return arg.type.kind === IrisKind.NON_NULL_TYPE && arg.defaultValue == null;
}
