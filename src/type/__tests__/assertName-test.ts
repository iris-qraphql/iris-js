import { assertEnumValueName, assertName } from '../assertName';

describe('assertName', () => {
  it('passthrough valid name', () => {
    expect(assertName('_ValidName123')).toEqual('_ValidName123');
  });

  it('throws for non-strings', () => {
    expect(() => assertName({} as any)).toThrowErrorMatchingSnapshot();
  });

  it('throws on empty strings', () => {
    expect(() => assertName('')).toThrowErrorMatchingSnapshot();
  });

  it('throws for names with invalid characters', () => {
    expect(() => assertName('>--()-->')).toThrowErrorMatchingSnapshot();
  });

  it('throws for names starting with invalid characters', () => {
    expect(() => assertName('42MeaningsOfLife')).toThrowErrorMatchingSnapshot();
  });
});

describe('assertEnumValueName', () => {
  it('passthrough valid name', () => {
    expect(assertEnumValueName('_ValidName123')).toThrowErrorMatchingSnapshot();
  });

  it('throws on empty strings', () => {
    expect(() => assertEnumValueName('')).toThrowErrorMatchingSnapshot();
  });

  it('throws for names with invalid characters', () => {
    expect(() =>
      assertEnumValueName('>--()-->'),
    ).toThrowErrorMatchingSnapshot();
  });

  it('throws for names starting with invalid characters', () => {
    expect(() =>
      assertEnumValueName('42MeaningsOfLife'),
    ).toThrowErrorMatchingSnapshot();
  });

  it('throws for restricted names', () => {
    expect(() => assertEnumValueName('true')).toThrowErrorMatchingSnapshot();
    expect(() => assertEnumValueName('false')).toThrowErrorMatchingSnapshot();
    expect(() => assertEnumValueName('null')).toThrowErrorMatchingSnapshot();
  });
});
