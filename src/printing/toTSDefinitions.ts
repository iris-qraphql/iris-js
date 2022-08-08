import type { Maybe } from 'graphql/jsutils/Maybe';

import type { IrisSchema } from '../types/schema';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

import { block, join, wrap } from './utils';

const mapping: Record<string, Maybe<string>> = {
  String: 'string',
  Int: 'number',
  Float: 'number',
};

const printTypesASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Document: { leave: (node) => join(node.definitions, '\n\n') },
  NamedType: { leave: ({ name }) => mapping[name] ?? name },
  ListType: { leave: ({ type }) => '[' + type + ']' },
  MaybeType: { leave: ({ type }) => `Maybe<${type}>` },
  FieldDefinition: {
    leave: ({ description, name, type, directives }) =>
      wrap('', description, '\n') +
      name +
      ': ' +
      type +
      wrap(' ', join(directives, ' ')),
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

const printFunctionsASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Document: { leave: (node) => join(node.definitions, '\n\n') },
  NamedType: { leave: ({ name }) => `iris${name}` },
  ListType: { leave: ({ type }) => '[' + type + ']' },
  MaybeType: { leave: ({ type }) => `irisMaybe(${type})` },
  FieldDefinition: {
    leave: ({ description, name, type, directives }) =>
      wrap('', description, '\n') +
      name +
      ': ' +
      type +
      wrap(' ', join(directives, ' ')),
  },
  TypeDefinition: {
    leave: ({ description, name, variants }) =>
      wrap('', description, '\n') +
      join([
        `export const iris${name} = oneOf<${name}>([${join(
          variants,
          ',\n',
        )}])`,
      ]),
  },
  VariantDefinition: {
    leave: ({ name, fields }) =>
      fields
        ? `irisVariant('${name}',${block([join(fields, ',\n')])})`
        : `iris${name}`,
  },
};

const inlineUtils = `
import type { Maybe } from '../scripts/utils';
import {
  irisFloat,
  irisInt,
  irisMaybe,
  irisString,
  irisVariant,
  oneOf,
} from '../scripts/utils';
`;

export const toTSDefinitions = (ast: IrisSchema): string =>
  inlineUtils +
  '\n\n' +
  visit(ast.document, printTypesASTReducer) +
  '\n\n' +
  visit(ast.document, printFunctionsASTReducer);
