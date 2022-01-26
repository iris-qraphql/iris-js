import { expect } from 'chai';
import { describe, it } from 'mocha';

import { isObjectLike } from '../isObjectLike';

describe('isObjectLike', () => {
  it('should return `true` for objects', () => {
    expect(isObjectLike({})).to.equal(true);
    expect(isObjectLike(Object.create(null))).to.equal(true);
    expect(isObjectLike(/a/)).to.equal(true);
    expect(isObjectLike([])).to.equal(true);
  });

  it('should return `false` for non-objects', () => {
    expect(isObjectLike(undefined)).to.equal(false);
    expect(isObjectLike(null)).to.equal(false);
    expect(isObjectLike(true)).to.equal(false);
    expect(isObjectLike('')).to.equal(false);
  });
});
