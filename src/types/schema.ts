import { validateSDL } from '../validation/validate';
import { parse } from '../parsing';

import {
  DirectiveDefinitionNode,
  DocumentNode,
  isDirectiveDefinitionNode,
  isTypeDefinitionNode,
  TypeDefinitionNode,
} from './ast';
import type { ObjMap } from 'graphql/jsutils/ObjMap';
import { keyMap } from '../utils/ObjMap';

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
