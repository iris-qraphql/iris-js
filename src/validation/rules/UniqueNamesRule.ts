import { forEachObjIndexed, groupBy } from 'ramda';

import type { NameNode, TypeDefinitionNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';

import type { SDLValidationContext } from '../ValidationContext';

const checkUniquenessBy =
  <T extends { name: NameNode }>(ctx: SDLValidationContext) =>
  (f: (x: string) => string, argumentNodes: ReadonlyArray<T>): void => {
    const seenArgs = groupBy((arg) => arg.name.value, argumentNodes);

    forEachObjIndexed((argNodes, argName) => {
      if (argNodes.length > 1) {
        ctx.reportError(
          irisNodeError(
            `${f(argName)} can only be defined once.`,
            argNodes.map((node) => node.name),
          ),
        );
      }
    }, seenArgs);
  };

const registerUniq = (context: SDLValidationContext) => {
  const knownNames: Record<string, NameNode> = {};

  return (node: NameNode) => {
    const name = node.value;
    if (knownNames[name]) {
      return context.reportError(
        irisNodeError(`There can be only one type named "${name}".`, [
          knownNames[name],
          node,
        ]),
      );
    }

    knownNames[name] = node;
  };
};

export function UniqueNamesRule(context: SDLValidationContext): ASTVisitor {
  const uniqTypeName = registerUniq(context);
  const uniq = checkUniquenessBy(context);

  return {
    TypeDefinition(type: TypeDefinitionNode) {
      const typeName = type.name.value;

      uniqTypeName(type.name);
      uniq((name) => `Variant "${typeName}.${name}"`, type.variants);

      for (const variant of type.variants) {
        const variantName = variant.name.value;
        const fields = variant.fields ?? [];

        uniq((name) => `Field "${variantName}.${name}"`, fields);

        for (const field of fields) {
          const fieldName = field.name.value;
          const args = field.arguments ?? [];

          uniq(
            (name) => `Argument "${variantName}.${fieldName}(${name}:)"`,
            args,
          );
        }
      }
    },
    DirectiveDefinition(node) {
      uniq(
        (argName) => `Argument "@${node.name.value}(${argName}:)"`,
        node.arguments ?? [],
      );
    },
  };
}
