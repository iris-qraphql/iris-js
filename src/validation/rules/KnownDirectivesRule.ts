import { irisError } from '../../error';
import type { ASTNode } from '../../types/ast';
import { specifiedDirectives } from '../../types/ast';
import type { GQLKind } from '../../types/kinds';
import { IrisDirectiveLocation, IrisKind } from '../../types/kinds';
import { inspect, invariant } from '../../utils/legacy';
import type { ASTVisitor } from '../../utils/visitor';

import type { IrisValidationContext } from '../ValidationContext';

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 */
export function KnownDirectivesRule(
  context: IrisValidationContext,
): ASTVisitor {
  const locationsMap = Object.create(null);

  for (const directive of specifiedDirectives) {
    locationsMap[directive.name] = directive.locations;
  }

  return {
    Directive(node, _key, _parent, _path, ancestors) {
      const name = node.name.value;
      const locations = locationsMap[name];

      if (!locations) {
        context.reportError(
          irisError(`Unknown directive "@${name}".`, { nodes: node }),
        );
        return;
      }

      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (candidateLocation && !locations.includes(candidateLocation)) {
        context.reportError(
          irisError(
            `Directive "@${name}" may not be used on ${candidateLocation}.`,
            { nodes: node },
          ),
        );
      }
    },
  };
}

function getDirectiveLocationForASTPath(
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
): IrisDirectiveLocation | undefined {
  const appliedTo = ancestors[ancestors.length - 1];
  invariant('kind' in appliedTo);

  switch (appliedTo.kind) {
    case IrisKind.FIELD_DEFINITION:
      return IrisDirectiveLocation.FIELD_DEFINITION;
    case IrisKind.TYPE_DEFINITION:
      return IrisDirectiveLocation.DATA_DEFINITION;
    case IrisKind.VARIANT_DEFINITION:
      return IrisDirectiveLocation.VARIANT_DEFINITION;
    case IrisKind.ARGUMENT_DEFINITION: {
      const parentNode = ancestors[ancestors.length - 3];
      invariant('kind' in parentNode);
      const kinds: ReadonlyArray<IrisKind | GQLKind> = [
        IrisKind.TYPE_DEFINITION,
        IrisKind.VARIANT_DEFINITION,
      ];
      return kinds.includes(parentNode.kind)
        ? IrisDirectiveLocation.FIELD_DEFINITION
        : IrisDirectiveLocation.ARGUMENT_DEFINITION;
    }
    default:
      invariant(false, 'Unexpected kind: ' + inspect(appliedTo.kind));
  }
}
