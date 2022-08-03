import { Kind } from 'graphql';

import type {
  TypeDefinitionNode,
  VariantDefinitionNode,
} from '../../types/ast';
import { IrisKind,scalarNames } from '../../types/kinds';
import type { ASTVisitor } from '../../types/visitor';

import type { IrisValidationContext } from '../ValidationContext';

const makeScalar = (name: string): TypeDefinitionNode => ({
  kind: IrisKind.TYPE_DEFINITION,
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

    type.variants.forEach((v: VariantDefinitionNode) => {
      const name = v.name.value;
      const member =
        !v.fields &&
        (defaultTypes[name] ?? doc.find((x) => x.name.value === name));

      if (!member) {
        return undefined;
      }
    });

    return false;
  }
}
