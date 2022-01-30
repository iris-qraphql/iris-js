import type { GraphQLScalarType } from 'graphql';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql';

import type { IrisNamedType } from './definition';
import { IrisDataType } from './definition';

const liftScalar = <T>({
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

export const IrisInt = liftScalar<number>(GraphQLInt);

export const IrisFloat = liftScalar<number>(GraphQLFloat);

export const IrisString = liftScalar(GraphQLString);

export const IrisBool = liftScalar(GraphQLBoolean);

export const IrisID = liftScalar(GraphQLID);

export const specifiedScalarTypes: ReadonlyArray<IrisDataType> = Object.freeze([
  IrisString,
  IrisInt,
  IrisFloat,
  IrisBool,
  IrisID,
]);

export function isSpecifiedScalarType(type: IrisNamedType): boolean {
  return specifiedScalarTypes.some(({ name }) => type.name === name);
}
