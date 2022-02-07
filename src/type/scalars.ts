import type { GraphQLScalarType } from 'graphql';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql';

import type { IrisNamedType } from './definition';
import { IrisTypeDefinition } from './definition';

const liftScalar = <I, O = I>(scalar: GraphQLScalarType<I, O>) =>
  new IrisTypeDefinition({
    role: 'data',
    name: scalar.name,
    description: scalar.description,
    variants: [{ name: scalar.name }],
    scalar,
  });

export const IrisInt = liftScalar<number>(GraphQLInt);

export const IrisFloat = liftScalar<number>(GraphQLFloat);

export const IrisString = liftScalar(GraphQLString);

export const IrisBool = liftScalar(GraphQLBoolean);

export const IrisID = liftScalar(GraphQLID);

export const specifiedScalarTypes: ReadonlyArray<IrisTypeDefinition<'data'>> =
  Object.freeze([IrisString, IrisInt, IrisFloat, IrisBool, IrisID]);

export function isSpecifiedScalarType(type: IrisNamedType): boolean {
  return specifiedScalarTypes.some(({ name }) => type.name === name);
}
