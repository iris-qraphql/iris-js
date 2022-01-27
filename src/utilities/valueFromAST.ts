import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { keyMap } from '../jsutils/keyMap';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';

import type { ObjectValueNode, ValueNode } from '../language/ast';
import { Kind } from '../language/kinds';

import type { GraphQLInputType, IrisDataVariant } from '../type/definition';
import { isDataType, isListType, isNonNullType } from '../type/definition';

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
  type: GraphQLInputType,
  variables?: Maybe<ObjMap<unknown>>,
): unknown {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (isNonNullType(type)) {
    if (valueNode.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueNode, type.ofType, variables);
  }

  if (valueNode.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (isListType(type)) {
    const itemType = type.ofType;
    if (valueNode.kind === Kind.LIST) {
      const coercedValues = [];
      for (const itemNode of valueNode.values) {
        const itemValue = valueFromAST(itemNode, itemType, variables);
        if (itemValue === undefined) {
          return; // Invalid: intentionally return no value.
        }
        coercedValues.push(itemValue);
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(valueNode, itemType, variables);
    if (coercedValue === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }

  if (isDataType(type)) {
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
  /* c8 ignore next 3 */
  // Not reachable, all possible input types have been considered.
  invariant(false, 'Unexpected input type: ' + inspect(type));
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.

const parseVariantValue = (
  variant: IrisDataVariant,
  valueNode: ObjectValueNode,
  variables: Maybe<ObjMap<unknown>>,
): Maybe<ObjectValueNode> => {
  const coercedObj = Object.create(null);
  const fieldNodes = keyMap(valueNode.fields, (field) => field.name.value);
  for (const field of Object.values(variant.fields ?? {})) {
    const fieldNode = fieldNodes[field.name];
    const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
    if (fieldValue === undefined) {
      return; // Invalid: intentionally return no value.
    }
    coercedObj[field.name] = fieldValue;
  }
  return coercedObj;
};
