import type { Maybe } from '../utils/type-level';

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
export function join(
  maybeArray: Maybe<ReadonlyArray<string | undefined>>,
  separator = '',
): string {
  return maybeArray?.filter((x) => x).join(separator) ?? '';
}

/**
 * Given array, print each item on its own line, wrapped in an indented `{ }` block.
 */
export const block = (array: ReadonlyArray<string | undefined>) =>
  array.length > 0 ? `{\n${indent(join(array, '\n'))}\n}` : '{}';

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
 */
export function wrap(
  start: string,
  maybeString: Maybe<string>,
  end: string = '',
): string {
  return maybeString != null && maybeString !== ''
    ? start + maybeString + end
    : '';
}

export function indent(str: string): string {
  return wrap('  ', str.replace(/\n/g, '\n  '));
}
