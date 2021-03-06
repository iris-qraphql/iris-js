import { Kind } from 'graphql';

import { irisError } from '../../error';
import type {
  TypeDefinitionNode,
  VariantDefinitionNode,
} from '../../types/ast';
import { isTypeVariantNode } from '../../types/ast';
import { scalarNames } from '../../types/definition';
import { IrisKind } from '../../types/kinds';
import type { ASTVisitor } from '../../types/visitor';

import type { IrisValidationContext } from '../ValidationContext';

const makeScalar = (name: string): TypeDefinitionNode => ({
  kind: IrisKind.TYPE_DEFINITION,
  role: 'data',
  name: { kind: Kind.NAME, value: name },
  variants: [],
});

const defaultTypes: Record<string, TypeDefinitionNode> = Object.fromEntries(
  scalarNames.map((name) => [name, makeScalar(name)]),
);

export function IncludeOnlyVariantTypes(
  context: IrisValidationContext,
): ASTVisitor {
  const doc = context.getDocument().definitions;

  return {
    TypeDefinition: checkVariantUniqueness,
  };

  function checkVariantUniqueness(type: TypeDefinitionNode) {
    const typeName = type.name.value;

    type.variants.forEach((v: VariantDefinitionNode) => {
      const name = v.name.value;
      const member =
        !v.fields &&
        (defaultTypes[name] ?? doc.find((x) => x.name.value === name));

      if (!member) {
        return undefined;
      }

      if (
        member.kind !== IrisKind.TYPE_DEFINITION ||
        member.role !== type.role ||
        !isTypeVariantNode(member)
      ) {
        context.reportError(
          irisError(
            `${type.role} ${typeName} can only include ${type.role} variantTypes, it cannot include ${member.role} ${member.name.value}.`,
            { nodes: v },
          ),
        );
      }
    });

    return false;
  }
}
