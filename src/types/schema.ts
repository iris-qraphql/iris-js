import type { ObjMap } from 'graphql/jsutils/ObjMap';

import { validateSDL } from '../validation/validate';

import { parse } from '../parsing';
import { keyMap } from '../utils/ObjMap';

import type {
  DirectiveDefinitionNode,
  DocumentNode,
  TypeDefinitionNode} from './ast';
import {
  isDirectiveDefinitionNode,
  isTypeDefinitionNode
} from './ast';

type IrisSchema = {
  readonly types: ObjMap<TypeDefinitionNode>;
  readonly directives: ObjMap<DirectiveDefinitionNode>;
  readonly document: DocumentNode;
};

type ParseOptions = {
  noLocation?: boolean;
};

export const buildSchema = (
  source: string,
  options?: ParseOptions,
): IrisSchema => {
  const document = parse(source, { noLocation: options?.noLocation });
  const errors = validateSDL(document);

  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }

  const types = keyMap(
    document.definitions.filter(isTypeDefinitionNode),
    (x) => x.name.value,
  );

  const directives = keyMap(
    document.definitions.filter(isDirectiveDefinitionNode),
    (x) => x.name.value,
  );

  return {
    document,
    directives,
    types,
  };
};

export type { IrisSchema };
