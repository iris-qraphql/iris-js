import { Kind } from 'graphql';

import type { ObjectValueNode, ValueNode } from '../language/ast';

import type { IrisStrictType, IrisVariant } from '../type/definition';
import { isMaybeType, isTypeRef } from '../type/definition';

import type { ObjMap } from '../utils/ObjMap';
import { keyMap } from '../utils/ObjMap';
import type { Maybe } from '../utils/type-level';

/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Unknown       |
 * | NullValue            | null          |
 *
 */
export function valueFromAST(
  valueNode: Maybe<ValueNode>,
  type: IrisStrictType,
  variables?: Maybe<ObjMap<unknown>>,
): unknown {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    if (variables == null || variables[variableName] === undefined) {
      // No valid return value.
      return;
    }
    const variableValue = variables[variableName];
    if (variableValue === null && !isMaybeType(type)) {
      return; // Invalid: intentionally return no value.
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes that this query has been validated and the variable
    // usage here is of the correct type.
    return variableValue;
  }

  if (isTypeRef(type)) {
    switch (type.kind) {
      case 'MAYBE': {
        if (valueNode.kind === Kind.NULL) {
          // This is explicitly returning the value null.
          return null;
        }
        return valueFromAST(valueNode, type.ofType, variables);
      }

      case 'LIST': {
        if (valueNode.kind === Kind.NULL) {
          return;
        }
        const itemType = type.ofType;
        if (valueNode.kind === Kind.LIST) {
          const coercedValues = [];
          for (const itemNode of valueNode.values) {
            if (isMissingVariable(itemNode, variables)) {
              // If an array contains a missing variable, it is either coerced to
              // null or if the item type is non-null, it considered invalid.
              if (!isMaybeType(itemType)) {
                return; // Invalid: intentionally return no value.
              }
              coercedValues.push(null);
            } else {
              const itemValue = valueFromAST(itemNode, itemType, variables);
              if (itemValue === undefined) {
                return; // Invalid: intentionally return no value.
              }
              coercedValues.push(itemValue);
            }
          }
          return coercedValues;
        }

        const coercedValue = valueFromAST(valueNode, itemType, variables);
        if (coercedValue === undefined) {
          return; // Invalid: intentionally return no value.
        }

        return [coercedValue];
      }
    }
  }

  if (valueNode.kind === Kind.NULL) {
    return;
  }

  if (valueNode.kind === Kind.OBJECT && !type.isPrimitive) {
    const variantName = valueNode.fields.find(
      (x) => x.name.value === '__typename',
    )?.value;

    if (variantName && variantName.kind !== Kind.STRING) {
      return undefined;
    }

    const variant = type.variantBy(variantName?.value);
    return parseVariantValue(variant, valueNode, variables);
  }

  // Scalars and Enums fulfill parsing a literal value via parseLiteral().
  // Invalid values represent a failure to parse correctly, in which case
  // no value is returned.
  let result;
  try {
    result = type.parseLiteral(valueNode);
  } catch (_error) {
    return; // Invalid: intentionally return no value.
  }
  if (result === undefined) {
    return; // Invalid: intentionally return no value.
  }
  return result;
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
): boolean {
  return (
    valueNode.kind === Kind.VARIABLE &&
    (variables == null || variables[valueNode.name.value] === undefined)
  );
}

const parseVariantValue = (
  variant: IrisVariant<'data'>,
  valueNode: ObjectValueNode,
  variables: Maybe<ObjMap<unknown>>,
): Maybe<ObjectValueNode> => {
  const coercedObj = Object.create(null);
  const fieldNodes = keyMap(valueNode.fields, (field) => field.name.value);
  for (const field of Object.values(variant.fields ?? {})) {
    const fieldNode = fieldNodes[field.name];
    if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
      if (!isMaybeType(field.type)) {
        return; // Invalid: intentionally return no value.
      }
      continue;
    }
    const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
    if (fieldValue === undefined) {
      return; // Invalid: intentionally return no value.
    }
    coercedObj[field.name] = fieldValue;
  }
  return coercedObj;
};
