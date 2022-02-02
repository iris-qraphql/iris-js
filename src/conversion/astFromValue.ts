import { Kind } from 'graphql';

import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';
import { isIterableObject, isObjectLike } from '../jsutils/ObjMap';

import type {
  ObjectFieldNode,
  ObjectValueNode,
  ValueNode,
} from '../language/ast';

import type {
  IrisDataType,
  IrisStrictType,
  IrisVariant,
} from '../type/definition';
import { isTypeRef } from '../type/definition';
import { IrisID } from '../type/scalars';

/**
 * Produces a GraphQL Value AST given a JavaScript object.
 * Function will match JavaScript/JSON values to GraphQL AST schema format
 * by using suggested GraphQLInputType. For example:
 *
 *     astFromValue("value", IrisString)
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * JavaScript values.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String / Enum Value  |
 * | Number        | Int / Float          |
 * | Unknown       | Enum Value           |
 * | null          | NullValue            |
 *
 */
export function astFromValue(
  value: unknown,
  type: IrisStrictType,
): Maybe<ValueNode> {
  if (isTypeRef(type)) {
    const itemType = type.ofType;

    switch (type.kind) {
      case 'MAYBE':
        // only explicit null, not undefined, NaN
        return value === null
          ? { kind: Kind.NULL }
          : astFromValue(value, itemType);
      case 'LIST': {
        if (isIterableObject(value)) {
          const valuesNodes = [];
          for (const item of value) {
            const itemNode = astFromValue(item, itemType);
            if (itemNode != null) {
              valuesNodes.push(itemNode);
            }
          }
          return { kind: Kind.LIST, values: valuesNodes };
        }
        return astFromValue(value, itemType);
      }
      default:
        return astFromValue(value, itemType);
    }
  }

  // handles only required required
  if (value === undefined || value === null) {
    return null;
  }

  return parseDataType(value, type);
}

/**
 * IntValue:
 *   - NegativeSign? 0
 *   - NegativeSign? NonZeroDigit ( Digit+ )?
 */
const integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;

const parseDataType = (
  value: unknown,
  type: IrisDataType,
): Maybe<ValueNode> => {
  if (!type.isPrimitive && isObjectLike(value)) {
    const variantName = value.__typename as string | undefined;
    const variant = type.variantBy(variantName);
    return parseVariantValue(value, variant);
  }

  // Since value is an internally represented value, it must be serialized
  // to an externally represented value before converting into an AST.
  const serialized = type.serialize(value);
  if (serialized == null) {
    return null;
  }

  // Others serialize based on their corresponding JavaScript scalar types.
  if (typeof serialized === 'boolean') {
    return { kind: Kind.BOOLEAN, value: serialized };
  }

  // JavaScript numbers can be Int or Float values.
  if (typeof serialized === 'number' && Number.isFinite(serialized)) {
    const stringNum = String(serialized);
    return integerStringRegExp.test(stringNum)
      ? { kind: Kind.INT, value: stringNum }
      : { kind: Kind.FLOAT, value: stringNum };
  }

  if (typeof serialized === 'string') {
    // Enum types use Enum literals.
    if (!type.isPrimitive) {
      return { kind: Kind.ENUM, value: serialized };
    }

    // ID types can use Int literals.
    if (type === IrisID && integerStringRegExp.test(serialized)) {
      return { kind: Kind.INT, value: serialized };
    }

    return {
      kind: Kind.STRING,
      value: serialized,
    };
  }

  throw new TypeError(`Cannot convert value to AST: ${inspect(serialized)}.`);
};

const parseVariantValue = (
  value: Record<string, unknown>,
  variant: IrisVariant<'data'>,
): ObjectValueNode => {
  const fieldNodes: Array<ObjectFieldNode> = [];

  Object.values(variant.fields ?? {}).forEach(({ name, type }) => {
    const fieldValue = astFromValue(value[name], type);
    if (fieldValue) {
      fieldNodes.push({
        kind: Kind.OBJECT_FIELD,
        name: { kind: Kind.NAME, value: name },
        value: fieldValue,
      });
    }
  });

  return { kind: Kind.OBJECT, fields: fieldNodes };
};
