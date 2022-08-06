import { printBlockString } from 'graphql/language/blockString';
import { printString } from 'graphql/language/printString';

import type { ASTNode } from '../types/ast';
import type { IrisSchema } from '../types/schema';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

import { block, join, wrap } from './utils';

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
  StringValue: {
    leave: ({ value, block: isBlockString }) =>
      isBlockString ? printBlockString(value) : printString(value),
  },
  NullValue: { leave: () => 'null' },
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



export const print = (ast: IrisSchema): string =>
  visit(ast.document, printDocASTReducer);

export const printNode = (ast: ASTNode): string =>
  visit(ast, printDocASTReducer);
