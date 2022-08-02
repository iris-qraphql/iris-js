import { printBlockString } from 'graphql/language/blockString';
import { printString } from 'graphql/language/printString';

import type { ASTNode } from '../types/ast';
import type { ASTReducer } from '../types/visitor';
import { visit } from '../types/visitor';
import type { Maybe } from '../utils/type-level';

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Variable: { leave: (node) => '$' + node.name },
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

  VariantDefinition: { leave: ({ name }) => name + block([]) },

  DirectiveDefinition: {
    leave: ({ description, name, arguments: args, repeatable, locations }) =>
      wrap('', description, '\n') +
      'directive @' +
      name +
      (hasMultilineItems(args)
        ? wrap('(\n', indent(join(args, '\n')), '\n)')
        : wrap('(', join(args, ', '), ')')) +
      (repeatable ? ' repeatable' : '') +
      ' on ' +
      join(locations, ' | '),
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
function block(array: Maybe<ReadonlyArray<string | undefined>>): string {
  return wrap('{\n', indent(join(array, '\n')), '\n}');
}

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

function hasMultilineItems(maybeArray: Maybe<ReadonlyArray<string>>): boolean {
  /* c8 ignore next */
  return maybeArray?.some((str) => str.includes('\n')) ?? false;
}

export const print = (ast: ASTNode): string => visit(ast, printDocASTReducer);
