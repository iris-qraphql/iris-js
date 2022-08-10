
import { irisDeity } from './schema';

const value = irisDeity({ __typename: 'God', name:'x' , lifespan: { __typename: 'Limited'} });

// eslint-disable-next-line no-console
console.log(value);
