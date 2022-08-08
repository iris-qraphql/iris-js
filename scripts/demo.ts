import { readFile, writeFile } from 'fs/promises';

import { iris } from '../src';

readFile('./scripts/schema.iris', { encoding: 'utf8' })
  .then((schema) => writeFile('generated/schema.ts', iris(schema)))
  .catch(console.error);
