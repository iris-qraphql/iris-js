import { TokenKind } from 'graphql';

import type {
  _FieldDefinitionNode,
  _TypeDefinitionNode,
  _VariantDefinitionNode,
  DefinitionNode,
  FieldDefinitionNode,
  NameNode,
  Role,
  TypeDefinition,
} from './ast';
import { IrisKind } from './kinds';
import type { Parser } from './parser';

export const parseDefinitions = (
  parser: Parser,
  keywordToken: string,
): DefinitionNode | undefined => {
  switch (keywordToken) {
    case 'resolver':
      return parseTypeDefinition('resolver', parser);
    case 'data':
      return parseTypeDefinition('data', parser);
    case 'directive':
      return parser.parseDirectiveDefinition();
  }

  return undefined;
};

const ROLE_KIND = {
  resolver: IrisKind.RESOLVER_TYPE_DEFINITION,
  data: IrisKind.DATA_TYPE_DEFINITION,
} as const;

export const parseTypeDefinition = <R extends Role>(
  role: R,
  parser: Parser,
): TypeDefinition<R> => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  parser.expectKeyword(role);
  const name = parser.parseName();
  const directives = parser.parseConstDirectives();
  const variants: ReadonlyArray<_VariantDefinitionNode<R>> =
    parseVariantsDefinition(role, name, parser);
  return parser.node<TypeDefinition<R>>(start, {
    kind: ROLE_KIND[role],
    description,
    name,
    directives,
    variants,
  });
};

export const parseVariantsDefinition = <R extends Role>(
  role: R,
  name: NameNode,
  parser: Parser,
): ReadonlyArray<_VariantDefinitionNode<R>> => {
  const isEquals = parser.expectOptionalToken(TokenKind.EQUALS);

  const afterEquals = parser.lookAhead().kind;
  if (isEquals && ![TokenKind.BRACE_L, TokenKind.NAME].includes(afterEquals)) {
    parser.throwExpected('Variant');
  }

  const isUnion = parser.lookAhead().kind !== TokenKind.BRACE_L;
  return isEquals && isUnion
    ? parser.delimitedMany(TokenKind.PIPE, () =>
        parseVariantDefinition(role, parser),
      )
    : [parseVariantDefinition(role, parser, name)];
};

const parseVariantDefinition = <R extends Role>(
  role: R,
  parser: Parser,
  typeName?: NameNode,
): _VariantDefinitionNode<R> => {
  const start = parser.lookAhead();
  const description = parser.parseDescription();
  const name = typeName ?? parseVariantName(parser);
  const directives = parser.parseConstDirectives();
  const fields = parseFieldsDefinition(role, parser);
  return parser.node<_VariantDefinitionNode<R>>(start, {
    kind: IrisKind.VARIANT_DEFINITION,
    description,
    name,
    directives,
    fields,
  });
};

const parseVariantName = (parser: Parser): NameNode => {
  const { value } = parser.lookAhead();
  if (value === 'true' || value === 'false' || value === 'null') {
    parser.invalidToken('is reserved and cannot be used for an enum value');
  }
  return parser.parseName();
};

const parseFieldsDefinition = <R extends Role>(
  role: R,
  parser: Parser,
): ReadonlyArray<_FieldDefinitionNode<R>> | undefined => {
  const nodes = [];
  if (parser.expectOptionalToken(TokenKind.BRACE_L)) {
    while (!parser.expectOptionalToken(TokenKind.BRACE_R)) {
      nodes.push(parseFieldDefinition(role, parser)());
    }
    return nodes;
  }
  return undefined;
};

const parseFieldDefinition =
  <R extends Role>(role: R, parser: Parser) =>
  (): _FieldDefinitionNode<R> => {
    const start = parser.lookAhead();
    const description = parser.parseDescription();
    const name = parser.parseName();
    const args = role === 'resolver' ? parser.parseArgumentDefs() : undefined;
    parser.expectToken(TokenKind.COLON);
    const type = parser.parseTypeReference();
    const directives = parser.parseConstDirectives();
    return parser.node<FieldDefinitionNode>(start, {
      kind: IrisKind.FIELD_DEFINITION,
      description,
      name,
      arguments: args,
      type,
      directives,
    });
  };
