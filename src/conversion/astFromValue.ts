import { Kind } from 'graphql';

import type { ObjectFieldNode, ValueNode } from '../language/ast';

import type {
  IrisDataType,
  IrisStrictType,
  IrisVariant,
} from '../type/definition';
import { isTypeRef } from '../type/definition';
import { IrisID } from '../type/scalars';

import { inspect } from '../utils/legacy';
import { isIterableObject, isObjectLike } from '../utils/ObjMap';
import type { Maybe } from '../utils/type-level';

import type { IrisVariantValue } from './serialize';
import { isEmptyVariant, parseVariantWith } from './serialize';

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
  if (!type.boxedScalar && (isObjectLike(value) || typeof value === 'string')) {
    return parseVariantWith(parseVariantValue, value, type);
  }

  // Since value is an internally represented value, it must be serialized
  // to an externally represented value before converting into an AST.
  const serialized = type.boxedScalar?.serialize(value);
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
    if (!type.boxedScalar) {
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
  object: IrisVariantValue,
  variant: IrisVariant<'data'>,
): ValueNode => {
  const fieldNodes: Array<ObjectFieldNode> = [];
  const variantFields = Object.values(variant.fields ?? {});
  const { name: __typename, fields } = object;

  if (isEmptyVariant(object, variantFields)) {
    return { kind: Kind.ENUM, value: __typename ?? '' };
  }

  Object.values(variant.fields ?? {}).forEach(({ name, type }) => {
    const fieldValue = astFromValue(fields[name], type);
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
