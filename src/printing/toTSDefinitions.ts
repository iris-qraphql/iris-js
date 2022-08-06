import type { IrisSchema } from '../types/schema';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

import { block, join, wrap } from './utils';

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Document: { leave: (node) => join(node.definitions, '\n\n') },
  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => '[' + type + ']' },
  MaybeType: { leave: ({ type }) => `(${type} | undefined)` },
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
          'export type',
          name,
          join(directives, ' '),
          wrap('= ', join(variants, ' | ')),
        ],
        ' ',
      ),
  },
  VariantDefinition: {
    leave: ({ name, fields }) =>
      fields === undefined ? name : block([`__typename: '${name}'`, ...fields]),
  },
};


export const toTSDefinitions = (ast: IrisSchema): string =>
  visit(ast.document, printDocASTReducer);
