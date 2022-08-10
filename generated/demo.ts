/* eslint-disable no-console */
import { debug } from '../scripts/utils';

import { irisDeity, irisGod, irisLifespan } from './schema';

const deities = [
  { __typename: 'Titan', name: 'x', power: 0.5 },
  {
    __typename: 'God',
    name: 'Iris',
    lifespan: { __typename: 'Limited', max: 1 },
  },
].map(debug(irisDeity));

const gods = [
  {
    __typename: 'God',
    name: 'Iris',
    lifespan: { __typename: 'Limited' },
  },
  { __typename: 'Titan' },
  { __typename: 'God' },
  { __typename: 'God', name: 5 },
  { __typename: 'God', name: 'Iris' },
].map(debug(irisGod));

const lifespans = [
  { __typename: 'Limited' },
  { __typename: 'Immortal' },
  { __typename: 'Limited', max: 1 },
  { __typename: 'Limited', max: 1.9 },
  { __typename: 'unknown' },
].map(debug(irisLifespan));

console.log('\nDEITIES::', deities);
console.log('\nGODS::', gods);
console.log('\nLIFESPANS::', lifespans);
