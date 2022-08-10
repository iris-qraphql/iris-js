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

export const irisLifespan = oneOf<Lifespan>({
  Immortal: irisVariant({}),
  Limited: irisVariant({
    max: irisMaybe(irisInt),
  }),
});

export const irisGod = oneOf<God>({
  God: irisVariant({
    name: irisString,
    lifespan: irisLifespan,
  }),
});

export const irisDeity = oneOf<Deity>({
  God: irisGod,
  Titan: irisVariant({
    name: irisString,
    power: irisFloat,
  }),
});
