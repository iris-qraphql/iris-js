import { DirectiveNode, isTypeDefinitionNode, ParseOptions, Source } from 'graphql';
import { prop, uniqBy } from 'ramda';


import { validateSDL } from '../validation/validate';

import { parse } from '../parsing';
import type { IrisMaybe, Maybe } from '../utils/type-level';


import {
  ArgumentDefinitionNode,
  DirectiveDefinitionNode,
  FieldDefinitionNode,
  isDirectiveDefinitionNode,
  NamedTypeNode,
  TypeDefinitionNode,
  TypeNode,
  VariantDefinitionNode,
} from './ast';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  specifiedDirectives,
} from './directives';
import { IrisKind } from './kinds';
import type { ObjMap } from 'graphql/jsutils/ObjMap';

type IrisSchema = {
  readonly types: ObjMap<TypeDefinitionNode>;
  readonly directives: ObjMap<DirectiveDefinitionNode>;
};

export function buildSchema(
  source: string | Source,
  options?: ParseOptions,
): IrisSchema {
  const documentAST = parse(source, { noLocation: options?.noLocation });
  const errors = validateSDL(documentAST);

  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }


  const {definitions} = documentAST;


  const types = uniqBy(prop('name'), definitions.filter(isTypeDefinitionNode));

  const directives = uniqBy(prop('name'), definitions.filter(isDirectiveDefinitionNode));

  return {
    directives,
    types,
  };
}



export type { IrisSchema };
