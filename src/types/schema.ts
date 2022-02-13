import type { DirectiveNode, ParseOptions, Source } from 'graphql';
import { prop, uniqBy } from 'ramda';

import { typeCheckASTValue } from '../validation/typeCheckASTValue';
import { validateSDL } from '../validation/validate';

import type { IrisError } from '../error';
import { irisNodeError } from '../error';
import { parse } from '../parsing';
import type { TypeMap } from '../utils/collectTypeMap';
import { collectTypeMap } from '../utils/collectTypeMap';
import { inspect } from '../utils/legacy';
import type { IrisMaybe, Maybe } from '../utils/type-level';
import { notNill } from '../utils/type-level';

import type {
  ArgumentDefinitionNode,
  DirectiveDefinitionNode,
  FieldDefinitionNode,
  NamedTypeNode,
  Role,
  TypeDefinitionNode,
  TypeNode,
  VariantDefinitionNode,
} from './ast';
import type {
  IrisArgument,
  IrisField,
  IrisType,
  IrisVariant,
} from './definition';
import { IrisScalars, IrisTypeDefinition, IrisTypeRef } from './definition';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  specifiedDirectives,
} from './directives';
import { IrisKind } from './kinds';

class IrisSchema {
  description: Maybe<string>;

  readonly query?: IrisTypeDefinition<'resolver'>;
  readonly mutation?: IrisTypeDefinition<'resolver'>;
  readonly subscription?: IrisTypeDefinition<'resolver'>;
  readonly directives: ReadonlyArray<GraphQLDirective>;
  readonly typeMap: TypeMap;

  // Used as a cache for validateSchema().
  __validationErrors: Maybe<ReadonlyArray<IrisError>>;

  constructor({
    description,
    query,
    mutation,
    subscription,
    types = [],
    directives = [],
  }: Readonly<IrisSchemaConfig>) {
    this.description = description;
    this.query = query;
    this.mutation = mutation;
    this.subscription = subscription;
    this.directives = uniqBy(prop('name'), [
      ...directives,
      ...specifiedDirectives,
    ]);

    this.typeMap = collectTypeMap(
      [query, mutation, subscription, ...types].filter(notNill),
      this.directives,
    );
  }

  get [Symbol.toStringTag]() {
    return 'IrisSchema';
  }

  getType = (name: string): IrisMaybe<IrisTypeDefinition> => this.typeMap[name];

  getDirective = (name: string): Maybe<GraphQLDirective> =>
    this.directives.find((directive) => directive.name === name);
}

export interface IrisSchemaConfig {
  description?: Maybe<string>;
  query?: IrisTypeDefinition<'resolver'>;
  mutation?: IrisTypeDefinition<'resolver'>;
  subscription?: IrisTypeDefinition<'resolver'>;
  types?: ReadonlyArray<IrisTypeDefinition>;
  directives?: ReadonlyArray<GraphQLDirective>;
}

export function buildSchema(
  source: string | Source,
  options?: ParseOptions,
): IrisSchema {
  const documentAST = parse(source, { noLocation: options?.noLocation });
  const errors = validateSDL(documentAST);

  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }

  const directiveDefs: Array<DirectiveDefinitionNode> = [];
  const typeMap: Record<string, IrisTypeDefinition> = {};

  function lookupType<R extends Role>(
    node: NamedTypeNode | VariantDefinitionNode<R>,
  ): IrisTypeDefinition<R> {
    const name = node.name.value;
    const type = IrisScalars[name] ?? typeMap[name];

    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }

    return type as IrisTypeDefinition<R>;
  }

  function getWrappedType(node: TypeNode): IrisType {
    if (node.kind === IrisKind.LIST_TYPE) {
      return new IrisTypeRef('LIST', getWrappedType(node.type));
    }
    if (node.kind === IrisKind.MAYBE_TYPE) {
      return new IrisTypeRef('MAYBE', getWrappedType(node.type));
    }
    return lookupType(node);
  }

  function buildDirective(node: DirectiveDefinitionNode): GraphQLDirective {
    return new GraphQLDirective({
      name: node.name.value,
      description: node.description?.value,
      locations: node.locations.map(({ value }) => value as any),
      isRepeatable: node.repeatable,
      args: node.arguments?.map(buildArgument),
      astNode: node,
    });
  }

  function buildArgument(astNode: ArgumentDefinitionNode): IrisArgument {
    const type: any = getWrappedType(astNode.type);
    const name = astNode.name.value;
    return {
      name,
      type,
      description: astNode.description?.value,
      defaultValue: typeCheckASTValue(astNode.defaultValue, type),
      deprecationReason: getDeprecationReason(astNode),
      astNode,
    };
  }

  const buildField = <R extends Role>(
    field: FieldDefinitionNode<R>,
  ): IrisField<R> =>
    ({
      name: field.name.value,
      type: getWrappedType(field.type),
      description: field.description?.value,
      deprecationReason: getDeprecationReason(field),
      astNode: field,
      args: field.arguments?.map(buildArgument),
      toJSON: () => field.name.value,
    } as IrisField<R>);

  const buildVariant = <R extends Role>(
    astNode: VariantDefinitionNode<R>,
  ): IrisVariant<R> => {
    const name = astNode.name.value;
    const description = astNode.description?.value;
    const deprecationReason = getDeprecationReason(astNode);

    if (!astNode.fields) {
      return {
        name,
        description,
        deprecationReason,
        astNode,
        type: lookupType(astNode),
      };
    }

    return {
      name,
      description,
      deprecationReason,
      fields: Object.fromEntries(
        (astNode.fields ?? []).map((field) => [
          field.name.value,
          buildField(field),
        ]),
      ),
      astNode,
    };
  };

  const buildType = <R extends Role>(
    astNode: TypeDefinitionNode<R>,
  ): IrisTypeDefinition<R> =>
    new IrisTypeDefinition({
      role: astNode.role,
      name: astNode.name.value,
      description: astNode.description?.value,
      variants: () => astNode.variants.map(buildVariant),
      astNode,
    });

  documentAST.definitions.forEach((def) => {
    const name = def.name.value;
    switch (def.kind) {
      case IrisKind.TYPE_DEFINITION:
        typeMap[name] = IrisScalars[name] ?? buildType(def);
        break;
      case IrisKind.DIRECTIVE_DEFINITION:
        directiveDefs.push(def);
        break;
    }
  });

  const assertRoot = (
    operation: string,
    type: IrisTypeDefinition,
  ): IrisTypeDefinition<'resolver'> => {
    if (type && !(type.role === 'resolver' && type.isVariantType)) {
      throw irisNodeError(
        `${operation} root type must be Object type${
          operation === 'Query' ? '' : ' if provided'
        }, it cannot be ${inspect(type)}.`,
        type.astNode,
      );
    }
    return type as IrisTypeDefinition<'resolver'>;
  };

  return new IrisSchema({
    description: undefined,
    types: Object.values(typeMap),
    query: assertRoot('query', typeMap.Query),
    mutation: assertRoot('mutation', typeMap.Mutation),
    subscription: assertRoot('subscription', typeMap.Subscription),
    directives: directiveDefs.map(buildDirective),
  });
}

function getDeprecationReason(node: {
  readonly directives?: ReadonlyArray<DirectiveNode>;
}): IrisMaybe<string> {
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === GraphQLDeprecatedDirective.name,
  );

  if (directiveNode === undefined) {
    return undefined;
  }

  const reason = directiveNode?.arguments?.find(
    (arg) => arg.name.value === 'reason',
  )?.value;

  return (typeCheckASTValue(reason, IrisScalars.String) as string) ?? '';
}

export type { IrisSchema };
