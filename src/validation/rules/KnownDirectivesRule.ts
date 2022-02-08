import type { Kind } from 'graphql';

import type { ASTNode } from '../../language/ast';
import { DirectiveLocation } from '../../language/directiveLocation';
import { IrisKind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';

import { specifiedDirectives } from '../../type/directives';

import { irisError } from '../../error';
import { inspect, invariant } from '../../utils/legacy';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext';

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 */
export function KnownDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const locationsMap = Object.create(null);

  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    locationsMap[directive.name] = directive.locations;
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === IrisKind.DIRECTIVE_DEFINITION) {
      locationsMap[def.name.value] = def.locations.map((name) => name.value);
    }
  }

  return {
    Directive(node, _key, _parent, _path, ancestors) {
      const name = node.name.value;
      const locations = locationsMap[name];

      if (!locations) {
        context.reportError(
          irisError(`Unknown directive "@${name}".`, { node }),
        );
        return;
      }

      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (candidateLocation && !locations.includes(candidateLocation)) {
        context.reportError(
          irisError(
            `Directive "@${name}" may not be used on ${candidateLocation}.`,
            { node },
          ),
        );
      }
    },
  };
}

function getDirectiveLocationForASTPath(
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
): DirectiveLocation | undefined {
  const appliedTo = ancestors[ancestors.length - 1];
  invariant('kind' in appliedTo);

  switch (appliedTo.kind) {
    case IrisKind.FIELD_DEFINITION:
      return DirectiveLocation.FIELD_DEFINITION;
    case IrisKind.TYPE_DEFINITION:
      return DirectiveLocation.UNION;
    case IrisKind.ARGUMENT_DEFINITION: {
      const parentNode = ancestors[ancestors.length - 3];
      invariant('kind' in parentNode);
      const kinds: ReadonlyArray<IrisKind | Kind> = [
        IrisKind.TYPE_DEFINITION,
        IrisKind.VARIANT_DEFINITION,
      ];
      return kinds.includes(parentNode.kind)
        ? DirectiveLocation.INPUT_FIELD_DEFINITION
        : DirectiveLocation.ARGUMENT_DEFINITION;
    }
    default:
      invariant(false, 'Unexpected kind: ' + inspect(appliedTo.kind));
  }
}
