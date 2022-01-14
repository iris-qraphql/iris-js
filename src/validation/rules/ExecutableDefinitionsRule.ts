import { GraphQLError } from '../../error/GraphQLError';

import { isExecutableDefinitionNode } from '../../language/predicates';
import type { ASTVisitor } from '../../language/visitor';

import type { ASTValidationContext } from '../ValidationContext';

/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 *
 * See https://spec.graphql.org/draft/#sec-Executable-Definitions
 */
export function ExecutableDefinitionsRule(
  context: ASTValidationContext,
): ASTVisitor {
  return {
    Document(node) {
      for (const definition of node.definitions) {
        if (!isExecutableDefinitionNode(definition)) {
          context.reportError(
            new GraphQLError(
              `The "${definition.name.value}" definition is not executable.`,
              definition,
            ),
          );
        }
      }
      return false;
    },
  };
}
