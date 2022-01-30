import type { GraphQLScalarType } from 'graphql';
import {
  GraphQLFloat as GQLFloat,
  GraphQLInt as GQLInt,
  GraphQLString as GQLString,
  Kind,
} from 'graphql';

import { inspect } from '../jsutils/inspect';
import { isObjectLike } from '../jsutils/ObjMap';

import { print } from '../language/printer';

import { GraphQLError } from '../error';

import type { IrisNamedType } from './definition';
import { IrisDataType } from './definition';
import { gqlScalar } from './make';

const liftGQLScalar = <T>({
  name,
  parseValue,
  parseLiteral,
  serialize,
}: GraphQLScalarType<T>) =>
  new IrisDataType<T>({
    name,
    isPrimitive: true,
    variants: [{ name }],
    parseValue,
    parseLiteral,
    serialize,
  });

export const GraphQLInt = liftGQLScalar<number>(GQLInt);

export const GraphQLFloat = liftGQLScalar<number>(GQLFloat);

export const GraphQLString = liftGQLScalar<string>(GQLString);

export const GraphQLBoolean = gqlScalar<boolean>({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',

  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);

    if (typeof coercedValue === 'boolean') {
      return coercedValue;
    }
    if (Number.isFinite(coercedValue)) {
      return coercedValue !== 0;
    }
    throw new GraphQLError(
      `Boolean cannot represent a non boolean value: ${inspect(coercedValue)}`,
    );
  },

  parseValue(inputValue) {
    if (typeof inputValue !== 'boolean') {
      throw new GraphQLError(
        `Boolean cannot represent a non boolean value: ${inspect(inputValue)}`,
      );
    }
    return inputValue;
  },

  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.BOOLEAN) {
      throw new GraphQLError(
        `Boolean cannot represent a non boolean value: ${print(valueNode)}`,
        valueNode,
      );
    }
    return valueNode.value;
  },
});

export const GraphQLID = gqlScalar<string>({
  name: 'ID',
  description:
    'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',

  serialize(outputValue) {
    const coercedValue = serializeObject(outputValue);

    if (typeof coercedValue === 'string') {
      return coercedValue;
    }
    if (Number.isInteger(coercedValue)) {
      return String(coercedValue);
    }
    throw new GraphQLError(
      `ID cannot represent value: ${inspect(outputValue)}`,
    );
  },

  parseValue(inputValue) {
    if (typeof inputValue === 'string') {
      return inputValue;
    }
    if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
      return inputValue.toString();
    }
    throw new GraphQLError(`ID cannot represent value: ${inspect(inputValue)}`);
  },

  parseLiteral(valueNode) {
    if (valueNode.kind !== Kind.STRING && valueNode.kind !== Kind.INT) {
      throw new GraphQLError(
        'ID cannot represent a non-string and non-integer value: ' +
          print(valueNode),
        valueNode,
      );
    }
    return valueNode.value;
  },
});

export const specifiedScalarTypes: ReadonlyArray<IrisDataType> = Object.freeze([
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
]);

export function isSpecifiedScalarType(type: IrisNamedType): boolean {
  return specifiedScalarTypes.some(({ name }) => type.name === name);
}

// Support serializing objects with custom valueOf() or toJSON() functions -
// a common way to represent a complex value which can be represented as
// a string (ex: MongoDB id objects).
function serializeObject(outputValue: unknown): unknown {
  if (isObjectLike(outputValue)) {
    if (typeof outputValue.valueOf === 'function') {
      const valueOfResult = outputValue.valueOf();
      if (!isObjectLike(valueOfResult)) {
        return valueOfResult;
      }
    }
    if (typeof outputValue.toJSON === 'function') {
      return outputValue.toJSON();
    }
  }
  return outputValue;
}
