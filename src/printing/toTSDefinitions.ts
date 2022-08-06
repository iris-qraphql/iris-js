import type { IrisSchema } from '../types/schema';
import type { ASTReducer } from '../utils/visitor';
import { visit } from '../utils/visitor';

import { block, join, wrap } from './utils';

const printTypesASTReducer: ASTReducer<string> = {
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

const printFunctionsASTReducer: ASTReducer<string> = {
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
    leave: ({ description, name, variants }) =>
      wrap('', description, '\n') +
      join([
        `export const parse${name} = oneOf<${name}>([${join(variants, ',\n')}])`,
      ]),
  },
  VariantDefinition: {
    leave: ({ name, fields }) =>
      `parseVariant(${block([
        join([`__typename: '${name}'`, ...(fields ?? [])], ',\n'),
      ])})`,
  },
};

const inlineUtils = `
export const oneOf =
  <T>(r: [(v: unknown) => T]) =>
  (v: unknown): T | undefined => {
    const res = r.find(f => f(v));

    if (res === undefined) {
      throw new Error('');
    }

    return res(v);
  };

export const parseVariant =
  <O extends Record<string, unknown>>(pattern: {
    [K in keyof O]: (f: unknown) => O[K];
  }) =>
  (v: unknown): O | undefined => {
    const result = {} as O;
    const keys: ReadonlyArray<keyof O> = Object.keys(pattern);

    if (typeof v !== 'object' || !v) {
      return undefined;
    }

    for (const key of keys) {
      result[key] = pattern[key]((v as Record<keyof O, unknown>)[key]);
    }

    return result;
  };
`;

export const toTSDefinitions = (ast: IrisSchema): string =>
  visit(ast.document, printTypesASTReducer) +
  '\n' +
  inlineUtils +
  visit(ast.document, printFunctionsASTReducer);
