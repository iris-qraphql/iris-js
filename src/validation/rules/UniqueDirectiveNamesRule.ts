import type { ASTVisitor } from '../../language/visitor';

import { irisError } from '../../error';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique directive names
 *
 * A GraphQL document is only valid if all defined directives have unique names.
 */
export function UniqueDirectiveNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const knownDirectiveNames = Object.create(null);
  const schema = context.getSchema();

  return {
    DirectiveDefinition(node) {
      const directiveName = node.name.value;

      if (schema?.getDirective(directiveName)) {
        context.reportError(
          irisError(
            `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
            { node: node.name },
          ),
        );
        return;
      }

      if (knownDirectiveNames[directiveName]) {
        context.reportError(
          irisError(
            `There can be only one directive named "@${directiveName}".`,
            { node: [knownDirectiveNames[directiveName], node.name] },
          ),
        );
      } else {
        knownDirectiveNames[directiveName] = node.name;
      }

      return false;
    },
  };
}
