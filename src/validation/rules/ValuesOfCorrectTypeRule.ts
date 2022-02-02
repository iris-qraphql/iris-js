import type { ValueNode } from '../../language/ast';
import { print } from '../../language/printer';
import type { ASTVisitor } from '../../language/visitor';

import {
  getNamedType,
  isDataType,
  isListType,
  isMaybeType,
  unpackMaybe,
} from '../../type/definition';

import { GraphQLError } from '../../error';
import { didYouMean, inspect, suggestionList } from '../../utils/legacy';
import { keyMap } from '../../utils/ObjMap';
import { lookupObjectTypename } from '../../utils/type-level';

import type { ValidationContext } from '../ValidationContext';

export const ValuesOfCorrectTypeRule = (
  context: ValidationContext,
): ASTVisitor => ({
  ListValue(node) {
    // Note: TypeInfo will traverse into a list's item type, so look to the
    // parent input type to check if it is a list.
    const type = unpackMaybe(context.getParentInputType());

    if (!isListType(type)) {
      isValidValueNode(context, node);
      return false; // Don't traverse further.
    }
  },
  ObjectValue(node) {
    const type = getNamedType(context.getInputType());
    if (!(isDataType(type) && !type.isPrimitive)) {
      isValidValueNode(context, node);
      return false; // Don't traverse further.
    }
    // Ensure every required field exists.
    const nodeFields = keyMap(node.fields, (field) => field.name.value);
    const variantName = lookupObjectTypename(nodeFields);
    Object.values(type.variantBy(variantName).fields ?? {}).forEach(
      (fieldDef) => {
        if (!nodeFields[fieldDef.name] && !isMaybeType(fieldDef.type)) {
          context.reportError(
            new GraphQLError(
              `Field "${type.name}.${
                fieldDef.name
              }" of required type "${inspect(
                fieldDef.type,
              )}" was not provided.`,
              node,
            ),
          );
        }
      },
    );
  },
  ObjectField(node) {
    const parentType = getNamedType(context.getParentInputType());
    const fieldType = context.getInputType();
    if (!fieldType && isDataType(parentType) && parentType.isVariantType()) {
      const suggestions = suggestionList(
        node.name.value,
        Object.keys(parentType.variantBy().fields ?? {}),
      );
      context.reportError(
        new GraphQLError(
          `Field "${node.name.value}" is not defined by type "${parentType.name}".` +
            didYouMean(suggestions),
          node,
        ),
      );
    }
  },
  NullValue(node) {
    const type = context.getInputType();
    if (!isMaybeType(type)) {
      context.reportError(
        new GraphQLError(
          `Expected value of type "${inspect(type)}", found ${print(node)}.`,
          node,
        ),
      );
    }
  },
  EnumValue: (node) => isValidValueNode(context, node),
  IntValue: (node) => isValidValueNode(context, node),
  FloatValue: (node) => isValidValueNode(context, node),
  StringValue: (node) => isValidValueNode(context, node),
  BooleanValue: (node) => isValidValueNode(context, node),
});

/**
 * Any value literal may be a valid representation of a Scalar, depending on
 * that scalar type.
 */
function isValidValueNode(context: ValidationContext, node: ValueNode): void {
  // Report any error at the full type expected by the location.
  const locationType = context.getInputType();
  if (!locationType) {
    return;
  }

  const type = getNamedType(locationType);

  if (!isDataType(type)) {
    const typeStr = inspect(locationType);
    context.reportError(
      new GraphQLError(
        `Expected value of type "${typeStr}", found ${print(node)}.`,
        node,
      ),
    );
    return;
  }

  // Scalars and Enums determine if a literal value is valid via parseLiteral(),
  // which may throw or return an invalid value to indicate failure.
  try {
    if (type.parseLiteral(node) === undefined) {
      const typeStr = inspect(locationType);
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}.`,
          node,
        ),
      );
    }
  } catch (error) {
    const typeStr = inspect(locationType);
    if (error instanceof GraphQLError) {
      context.reportError(error);
    } else {
      context.reportError(
        new GraphQLError(
          `Expected value of type "${typeStr}", found ${print(node)}; ` +
            error.message,
          node,
          undefined,
          undefined,
          undefined,
          error, // Ensure a reference to the original error is maintained.
        ),
      );
    }
  }
}
