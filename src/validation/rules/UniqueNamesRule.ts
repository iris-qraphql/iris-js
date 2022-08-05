import { forEachObjIndexed, groupBy } from 'ramda';

import { irisError } from '../../error';
import type { NameNode, TypeDefinitionNode } from '../../types/ast';
import { scalarNames } from '../../types/kinds';
import type { ASTVisitor } from '../../utils/visitor';

import type { IrisValidationContext } from '../ValidationContext';

const checkUniquenessBy =
  (ctx: IrisValidationContext, kind?: string) =>
  (
    nodes: ReadonlyArray<{ name: NameNode }>,
    f?: (x: string) => string,
  ): void => {
    const seenArgs = groupBy((arg) => arg.name.value, nodes);
    const message = (name: string) =>
      f
        ? `${f(name)} can only be defined once.`
        : `There can be only one ${kind} named "${name}".`;

    forEachObjIndexed((argNodes, argName) => {
      if (argNodes.length > 1) {
        ctx.reportError(
          irisError(message(argName), {
            nodes: argNodes.map((node) => node.name),
          }),
        );
      }
    }, seenArgs);
  };

const registerUniq = (context: IrisValidationContext, kind: string) => {
  const knownNames: Record<string, NameNode> = {};

  return (node: NameNode) => {
    const name = node.value;
    if (knownNames[name]) {
      return context.reportError(
        irisError(`There can be only one ${kind} named "${name}".`, {
          nodes: [knownNames[name], node],
        }),
      );
    }

    knownNames[name] = node;
  };
};

export function UniqueNamesRule(context: IrisValidationContext): ASTVisitor {
  const uniq = checkUniquenessBy(context);
  const registerType = registerUniq(context, 'type');

  return {
    TypeDefinition(type: TypeDefinitionNode) {
      const typeName = type.name.value;

      if (scalarNames.includes(typeName)) {
        const message = `built-in type ${typeName} can't be overridden.`;
        context.reportError(irisError(message, { nodes: type.name }));
      }

      registerType(type.name);
      uniq(type.variants, (name) => `Variant "${typeName}.${name}"`);

      for (const variant of type.variants) {
        const variantName = variant.name.value;
        const fields = variant.fields ?? [];

        uniq(fields, (name) => `Field "${variantName}.${name}"`);
      }
    }
  };
}
