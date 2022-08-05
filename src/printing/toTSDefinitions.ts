import type { IrisSchema } from '../types/schema';
import type { Maybe } from '../utils/type-level';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Document: {
    leave: (node) => join(node.definitions, '\n\n'),
  },
  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => '[' + type + ']' },
  MaybeType: { leave: ({ type }) => `Maybe<${type}>` },
  // Type System Definitions

  FieldDefinition: {
    leave: ({ description, name, type, directives }) =>
      wrap('', description, '\n') +
      name +
      ': ' +
      type +
      wrap(' ', join(directives, ' ')),
  },

  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) =>
      wrap('', description, '\n') +
      join(
        [name + ': ' + type, wrap('= ', defaultValue), join(directives, ' ')],
        ' ',
      ),
  },

  TypeDefinition: {
    leave: ({ description, name, directives, variants }) =>
      wrap('', description, '\n') +
      join(
        [
          'type',
          name,
          join(directives, ' '),
          wrap('= ', join(variants, ' | ')),
        ],
        ' ',
      ),
  },

  VariantDefinition: {
    leave: ({ name, fields }) =>
      fields === undefined ? name : block([`__typename: "${name}"`, ...fields]),
  },
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(
  maybeArray: Maybe<ReadonlyArray<string | undefined>>,
  separator = '',
): string {
  return maybeArray?.filter((x) => x).join(separator) ?? '';
}

/**
 * Given array, print each item on its own line, wrapped in an indented `{ }` block.
 */
const block = (array: ReadonlyArray<string | undefined>) =>
  array.length > 0 ? `{\n${indent(join(array, '\n'))}\n}` : '{}';

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
 */
function wrap(
  start: string,
  maybeString: Maybe<string>,
  end: string = '',
): string {
  return maybeString != null && maybeString !== ''
    ? start + maybeString + end
    : '';
}

function indent(str: string): string {
  return wrap('  ', str.replace(/\n/g, '\n  '));
}

export const toTSDefinitions = (ast: IrisSchema): string =>
  visit(ast.document, printDocASTReducer);
