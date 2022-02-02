import { Kind } from 'graphql';

import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import { keyMap } from '../jsutils/ObjMap';

import type { DirectiveNode } from '../language/ast';
import { print } from '../language/printer';

import type { IrisField } from '../type/definition';
import { isMaybeType } from '../type/definition';
import type { GraphQLDirective } from '../type/directives';

import { GraphQLError } from '../error';

import { valueFromAST } from './valueFromAST';

function getArgumentValues(
  def: IrisField<'resolver'> | GraphQLDirective,
  node: DirectiveNode,
  variableValues?: Maybe<ObjMap<unknown>>,
): Record<string, unknown> {
  const coercedValues: Record<string, unknown> = {};

  /* c8 ignore next */
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = keyMap(argumentNodes, (arg) => arg.name.value);

  for (const argDef of def.args) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap[name];

    if (!argumentNode) {
      if (argDef.defaultValue !== undefined) {
        coercedValues[name] = argDef.defaultValue;
      } else if (!isMaybeType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${inspect(argType)}" ` +
            'was not provided.',
          node,
        );
      }
      continue;
    }

    const valueNode = argumentNode.value;
    let isNull = valueNode.kind === Kind.NULL;

    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        variableValues == null ||
        !hasOwnProperty(variableValues, variableName)
      ) {
        if (argDef.defaultValue !== undefined) {
          coercedValues[name] = argDef.defaultValue;
        } else if (!isMaybeType(argType)) {
          throw new GraphQLError(
            `Argument "${name}" of required type "${inspect(argType)}" ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            valueNode,
          );
        }
        continue;
      }
      isNull = variableValues[variableName] == null;
    }

    if (isNull && !isMaybeType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${inspect(argType)}" ` +
          'must not be null.',
        valueNode,
      );
    }

    const coercedValue = valueFromAST(valueNode, argType, variableValues);
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        valueNode,
      );
    }
    coercedValues[name] = coercedValue;
  }
  return coercedValues;
}

export function getDirectiveValues(
  directiveDef: GraphQLDirective,
  node: { readonly directives?: ReadonlyArray<DirectiveNode> },
  variableValues?: Maybe<ObjMap<unknown>>,
): undefined | Record<string, unknown> {
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );

  if (directiveNode) {
    return getArgumentValues(directiveDef, directiveNode, variableValues);
  }
}

function hasOwnProperty(obj: unknown, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
