import { specifiedScalarTypes } from 'graphql';

import { keyMap } from '../utils/ObjMap';

import type { IrisNamedType } from './definition';
import { IrisTypeDefinition } from './definition';

export const IrisScalars = keyMap(
  specifiedScalarTypes.map(
    (scalar) =>
      new IrisTypeDefinition({
        role: 'data',
        name: scalar.name,
        description: scalar.description,
        variants: [{ name: scalar.name }],
        scalar,
      }),
  ),
  ({ name }) => name,
);

export const scalarNames = Object.keys(IrisScalars);

export const isSpecifiedScalarType = (type: IrisNamedType): boolean =>
  Boolean(IrisScalars[type.name]);
