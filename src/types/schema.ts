import type { Maybe } from 'graphql/jsutils/Maybe';
import type { ObjMap } from 'graphql/jsutils/ObjMap';

import { validateSDL } from '../validation/validate';

import { parse } from '../parsing/parser';
import { keyMap } from '../utils/ObjMap';

import type { DocumentNode, TypeDefinitionNode } from './ast';
import { isTypeDefinitionNode } from './ast';

type IrisSchema = {
  readonly types: ObjMap<TypeDefinitionNode>;
  readonly document: DocumentNode;
};

export const buildSchema = (source: string): IrisSchema => {
  const document = parse(source);
  const errors = validateSDL(document);

  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }

  return {
    document,
    types: keyMap(
      document.definitions.filter(isTypeDefinitionNode),
      ({ name }) => name.value,
    ),
  };
};

export const getType = (
  schema: IrisSchema,
  name: string,
): Maybe<TypeDefinitionNode> => schema.types[name];

export type { IrisSchema };
