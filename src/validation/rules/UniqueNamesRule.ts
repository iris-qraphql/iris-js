import { forEachObjIndexed, groupBy } from 'ramda';

import { irisError } from '../../error';
import type { NameNode, TypeDefinitionNode } from '../../types/ast';
import type { ASTVisitor } from '../../types/visitor';

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
  const registerDirective = registerUniq(context, 'directive');

  return {
    TypeDefinition(type: TypeDefinitionNode) {
      const typeName = type.name.value;

      registerType(type.name);
      uniq(type.variants, (name) => `Variant "${typeName}.${name}"`);

      for (const variant of type.variants) {
        const variantName = variant.name.value;
        const fields = variant.fields ?? [];

        uniq(fields, (name) => `Field "${variantName}.${name}"`);
      }
    },
    DirectiveDefinition(node) {
      const directiveName = node.name.value;
      const args = node.arguments ?? [];

      registerDirective(node.name);
      uniq(args, (name) => `Argument "@${directiveName}(${name}:)"`);
    },
    Directive(node) {
      checkUniquenessBy(context, 'argument')(node.arguments ?? []);
    },
  };
}
