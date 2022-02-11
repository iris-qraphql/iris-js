import type { NameNode } from '../language/ast';

export function getDuplicates<T extends { name: NameNode }>(
  items: ReadonlyArray<T>,
): ReadonlyArray<[NameNode, T]> {
  const known: Record<string, NameNode> = {};
  const duplicates: Array<[NameNode, T]> = [];

  for (const item of items) {
    const name = item.name.value;

    if (known[name]) {
      duplicates.push([known[name], item]);
    } else {
      known[name] = item.name;
    }
  }

  return duplicates;
}
