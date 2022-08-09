import type { Maybe } from '../scripts/utils';
import {
  irisFloat,
  irisInt,
  irisMaybe,
  irisString,
  irisVariant,
  oneOf,
} from '../scripts/utils';

export type Lifespan =
  | {
      __typename: 'Immortal';
    }
  | {
      __typename: 'Limited';
      max: Maybe<number>;
    };

export type God = {
  __typename: 'God';
  name: string;
  lifespan: Lifespan;
};

export type Deity =
  | God
  | {
      __typename: 'Titan';
      name: string;
      power: number;
    };

export const irisLifespan = oneOf<Lifespan>([
  irisVariant('Immortal', {}),
  irisVariant('Limited', {
    max: irisMaybe(irisInt),
  }),
]);

export const irisGod = oneOf<God>([
  irisVariant('God', {
    name: irisString,
    lifespan: irisLifespan,
  }),
]);

export const irisDeity = oneOf<Deity>([
  irisGod,
  irisVariant('Titan', {
    name: irisString,
    power: irisFloat,
  }),
]);
