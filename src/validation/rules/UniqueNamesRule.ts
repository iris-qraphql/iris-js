import { forEachObjIndexed, groupBy } from 'ramda';

import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';
import type { NameNode, TypeDefinitionNode } from '../../types/ast';

import type { SDLValidationContext } from '../ValidationContext';

const checkUniquenessBy =
  (ctx: SDLValidationContext, kind?: string) =>
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
          irisNodeError(
            message(argName),
            argNodes.map((node) => node.name),
          ),
        );
      }
    }, seenArgs);
  };

const registerUniq = (context: SDLValidationContext, kind: string) => {
  const knownNames: Record<string, NameNode> = {};

  return (node: NameNode) => {
    const name = node.value;
    if (knownNames[name]) {
      return context.reportError(
        irisNodeError(`There can be only one ${kind} named "${name}".`, [
          knownNames[name],
          node,
        ]),
      );
    }

    knownNames[name] = node;
  };
};

export function UniqueNamesRule(context: SDLValidationContext): ASTVisitor {
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

        for (const field of fields) {
          const fieldName = field.name.value;
          const args = field.arguments ?? [];

          uniq(
            args,
            (name) => `Argument "${variantName}.${fieldName}(${name}:)"`,
          );
        }
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
