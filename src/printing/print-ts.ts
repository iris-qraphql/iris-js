import type { Maybe } from 'graphql/jsutils/Maybe';

import type { IrisSchema } from '../types/schema';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

import { block, indent, join, wrap } from './utils';

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
          variants.length === 1
            ? `= ${variants[0]};`
            : wrap(
                '=\n',
                indent(variants.map((x) => `| ${x}`).join('\n')),
                ';',
              ),
        ],
        ' ',
      ),
  },
  VariantDefinition: {
    leave: ({ name, fields, isTypeVariantNode }) => {
      if (!fields) {
        return name;
      }

      const rendering = block(
        [`__typename: '${name}'`, ...fields].map((x) => `${x};`),
      );

      return isTypeVariantNode ? rendering : indent(rendering).trimStart();
    },
  },
};

const printFunctionsASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Document: { leave: (node) => join(node.definitions, '\n\n') + '\n' },
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
        `export const iris${name} = oneOf<${name}>({\n${indent(
          variants.map((x) => x + ',').join('\n'),
        )}\n});`,
      ]),
  },
  VariantDefinition: {
    leave: ({ name, fields }) =>
      `${name}: ${
        fields
          ? `irisVariant(${block(fields.map((x) => `${x},`))})`
          : `iris${name}`
      }`,
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
  inlineUtils.trimStart() +
  '\n' +
  visit(ast.document, printTypesASTReducer) +
  '\n\n' +
  visit(ast.document, printFunctionsASTReducer);
