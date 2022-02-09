import { identity } from 'ramda';

import { isIterableObject, isObjectLike } from '../ObjMap';

describe('isObjectLike', () => {
  it('should return `true` for objects', () => {
    expect(isObjectLike({})).toEqual(true);
    expect(isObjectLike(Object.create(null))).toEqual(true);
    expect(isObjectLike(/a/)).toEqual(true);
    expect(isObjectLike([])).toEqual(true);
  });

  it('should return `false` for non-objects', () => {
    expect(isObjectLike(undefined)).toEqual(false);
    expect(isObjectLike(null)).toEqual(false);
    expect(isObjectLike(true)).toEqual(false);
    expect(isObjectLike('')).toEqual(false);
  });
});

describe('isIterableObject', () => {
  it('should return `true` for collections', () => {
    expect(isIterableObject([])).toEqual(true);
    expect(isIterableObject(new Int8Array(1))).toEqual(true);

    // eslint-disable-next-line no-new-wrappers
    expect(isIterableObject(new String('ABC'))).toEqual(true);

    function getArguments() {
      return arguments;
    }
    expect(isIterableObject(getArguments())).toEqual(true);

    const iterable = { [Symbol.iterator]: identity };
    expect(isIterableObject(iterable)).toEqual(true);

    function* generatorFunc() {
      /* do nothing */
    }
    expect(isIterableObject(generatorFunc())).toEqual(true);

    // But generator function itself is not iterable
    expect(isIterableObject(generatorFunc)).toEqual(false);
  });

  it('should return `false` for non-collections', () => {
    expect(isIterableObject(null)).toEqual(false);
    expect(isIterableObject(undefined)).toEqual(false);

    expect(isIterableObject('ABC')).toEqual(false);
    expect(isIterableObject('0')).toEqual(false);
    expect(isIterableObject('')).toEqual(false);

    expect(isIterableObject(1)).toEqual(false);
    expect(isIterableObject(0)).toEqual(false);
    expect(isIterableObject(NaN)).toEqual(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isIterableObject(new Number(123))).toEqual(false);

    expect(isIterableObject(true)).toEqual(false);
    expect(isIterableObject(false)).toEqual(false);
    // eslint-disable-next-line no-new-wrappers
    expect(isIterableObject(new Boolean(true))).toEqual(false);

    expect(isIterableObject({})).toEqual(false);
    expect(isIterableObject({ iterable: true })).toEqual(false);

    const iteratorWithoutSymbol = { next: identity };
    expect(isIterableObject(iteratorWithoutSymbol)).toEqual(false);

    const invalidIterable = {
      [Symbol.iterator]: { next: identity },
    };
    expect(isIterableObject(invalidIterable)).toEqual(false);

    const arrayLike: Record<string, unknown> = {};
    arrayLike[0] = 'Alpha';
    arrayLike[1] = 'Bravo';
    arrayLike[2] = 'Charlie';
    arrayLike.length = 3;

    expect(isIterableObject(arrayLike)).toEqual(false);
  });
});
