import { Kind } from 'graphql';

import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';
import type {
  TypeDefinitionNode,
  VariantDefinitionNode,
} from '../../types/ast';
import { scalarNames } from '../../types/definition';
import { IrisKind } from '../../types/kinds';

import type { SDLValidationContext } from '../ValidationContext';

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
  context: SDLValidationContext,
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
          irisNodeError(
            `${type.role} ${typeName} can only include ${type.role} variantTypes, it cannot include ${member.role} ${member.name.value}.`,
            v,
          ),
        );
      }
    });

    return false;
  }
}

const isTypeVariantNode = (type: TypeDefinitionNode) => {
  const { variants } = type;

  if (variants.length === 0) {
    return true;
  }

  const [variant] = variants;
  const typeName = type.name.value;

  return (
    variants.length === 1 &&
    variant.name.value === typeName &&
    variant.fields !== undefined
  );
};
