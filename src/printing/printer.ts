import { printBlockString } from 'graphql/language/blockString';
import { printString } from 'graphql/language/printString';

import type { ASTNode } from '../types/ast';
import type { IrisSchema } from '../types/schema';
import type { Maybe } from '../utils/type-level';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Document: {
    leave: (node) => join(node.definitions, '\n\n'),
  },
  Argument: { leave: ({ name, value }) => name + ': ' + value },
  IntValue: { leave: ({ value }) => value },
  FloatValue: { leave: ({ value }) => value },
  StringValue: {
    leave: ({ value, block: isBlockString }) =>
      isBlockString ? printBlockString(value) : printString(value),
  },
  BooleanValue: { leave: ({ value }) => (value ? 'true' : 'false') },
  NullValue: { leave: () => 'null' },
  EnumValue: {
    leave: ({ value }) => value,
  },
  ListValue: { leave: ({ values }) => '[' + join(values, ', ') + ']' },
  ObjectValue: { leave: ({ fields }) => '{' + join(fields, ', ') + '}' },
  ObjectField: { leave: ({ name, value }) => name + ': ' + value },

  // Directive

  Directive: {
    leave: ({ name, arguments: args }) =>
      '@' + name + wrap('(', join(args, ', '), ')'),
  },

  // Type

  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => '[' + type + ']' },
  MaybeType: { leave: ({ type }) => type + '?' },

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
          'data',
          name,
          join(directives, ' '),
          wrap('= ', join(variants, ' | ')),
        ],
        ' ',
      ),
  },

  VariantDefinition: {
    leave: ({ name, fields, isTypeVariantNode, directives }) =>
      fields === undefined
        ? name
        : (isTypeVariantNode ? '' : name + ' ') +
          wrap('', join(directives, ' '), ' ') +
          block(fields),
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

export const print = (ast: IrisSchema): string =>
  visit(ast.document, printDocASTReducer);

export const printNode = (ast: ASTNode): string =>
  visit(ast, printDocASTReducer);
