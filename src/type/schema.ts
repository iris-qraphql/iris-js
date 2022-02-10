import type { ParseOptions, Source } from 'graphql';
import { uniqBy } from 'ramda';

import type {
  ArgumentDefinitionNode,
  DirectiveDefinitionNode,
  FieldDefinitionNode,
  NamedTypeNode,
  Role,
  TypeDefinitionNode,
  TypeNode,
  VariantDefinitionNode,
} from '../language/ast';
import { IrisKind } from '../language/kinds';
import { parse } from '../language/parser';

import { validateSDL } from '../validation/validate';

import { valueFromAST } from '../conversion/valueFromAST';
import { getDirectiveValues } from '../conversion/values';
import type { IrisError } from '../error';
import type { ObjMap } from '../utils/ObjMap';
import type { IrisMaybe, Maybe } from '../utils/type-level';
import { notNill } from '../utils/type-level';

import { collectAllReferencedTypes } from './collectAllReferencedTypes';
import type {
  IrisArgument,
  IrisFieldConfig,
  IrisNamedType,
  IrisType,
  IrisVariantConfig,
} from './definition';
import { IrisScalars, IrisTypeDefinition, IrisTypeRef } from './definition';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  specifiedDirectives,
} from './directives';

class IrisSchema {
  description: Maybe<string>;

  readonly query?: IrisTypeDefinition<'resolver'>;
  readonly mutation?: IrisTypeDefinition<'resolver'>;
  readonly subscription?: IrisTypeDefinition<'resolver'>;
  readonly directives: ReadonlyArray<GraphQLDirective>;
  readonly typeMap: TypeMap;

  // Used as a cache for validateSchema().
  __validationErrors: Maybe<ReadonlyArray<IrisError>>;

  constructor(config: Readonly<IrisSchemaConfig>) {
    this.description = config.description;
    this.query = config.query ?? undefined;
    this.mutation = config.mutation ?? undefined;
    this.subscription = config.subscription ?? undefined;
    this.directives = uniqBy(
      ({ name }) => name,
      [...(config.directives ?? []), ...specifiedDirectives],
    );

    const types: Array<IrisNamedType> = [
      this.query,
      this.mutation,
      this.subscription,
      ...(config.types ?? []),
    ].filter(notNill);

    const typeMap: TypeMap = {};

    collectAllReferencedTypes(types, this.directives).forEach((namedType) => {
      const { name } = namedType;

      if (!name) {
        throw new Error(
          'One of the provided types for building the Schema is missing a name.',
        );
      }

      if (typeMap[name] !== undefined) {
        throw new Error(
          `Iris Schema must contain uniquely named types but contains multiple types named "${name}".`,
        );
      }

      typeMap[name] = namedType;
    });

    this.typeMap = typeMap;
  }

  get [Symbol.toStringTag]() {
    return 'IrisSchema';
  }

  getType = (name: string): IrisMaybe<IrisNamedType> => this.typeMap[name];

  getDirective = (name: string): Maybe<GraphQLDirective> =>
    this.directives.find((directive) => directive.name === name);
}

type TypeMap = ObjMap<IrisNamedType>;

export interface IrisSchemaConfig {
  description?: Maybe<string>;
  query?: Maybe<IrisTypeDefinition<'resolver'>>;
  mutation?: Maybe<IrisTypeDefinition<'resolver'>>;
  subscription?: Maybe<IrisTypeDefinition<'resolver'>>;
  types?: Maybe<ReadonlyArray<IrisNamedType>>;
  directives?: Maybe<ReadonlyArray<GraphQLDirective>>;
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
  const typeMap: Record<string, IrisNamedType> = {};

  function getNamedType<R extends Role>(
    node: NamedTypeNode | VariantDefinitionNode<R>,
  ): IrisNamedType<R> {
    const name = node.name.value;
    const type = IrisScalars[name] ?? typeMap[name];

    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }

    return type as IrisNamedType<R>;
  }

  function getWrappedType(node: TypeNode): IrisType {
    if (node.kind === IrisKind.LIST_TYPE) {
      return new IrisTypeRef('LIST', getWrappedType(node.type));
    }
    if (node.kind === IrisKind.MAYBE_TYPE) {
      return new IrisTypeRef('MAYBE', getWrappedType(node.type));
    }
    return getNamedType(node);
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
      defaultValue: valueFromAST(astNode.defaultValue, type),
      deprecationReason: getDeprecationReason(astNode),
      astNode,
    };
  }

  const buildField = <R extends Role>(
    field: FieldDefinitionNode<R>,
  ): IrisFieldConfig<R> =>
    ({
      type: getWrappedType(field.type),
      description: field.description?.value,
      deprecationReason: getDeprecationReason(field),
      astNode: field,
      args: field.arguments?.map(buildArgument),
    } as IrisFieldConfig<R>);

  const buildVariant = <R extends Role>(
    astNode: VariantDefinitionNode<R>,
  ): IrisVariantConfig<R> => {
    const name = astNode.name.value;
    const description = astNode.description?.value;
    const deprecationReason = getDeprecationReason(astNode);

    if (!astNode.fields) {
      return {
        name,
        description,
        deprecationReason,
        astNode,
        type: getNamedType(astNode),
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

  return new IrisSchema({
    description: undefined,
    types: Object.values(typeMap),
    query: typeMap.Query as IrisTypeDefinition<'resolver'>,
    mutation: typeMap.Mutation as IrisTypeDefinition<'resolver'>,
    subscription: typeMap.Subscription as IrisTypeDefinition<'resolver'>,
    directives: directiveDefs.map(buildDirective),
  });
}

const getDeprecationReason = (
  node:
    | FieldDefinitionNode<Role>
    | ArgumentDefinitionNode
    | VariantDefinitionNode<Role>,
): Maybe<string> =>
  getDirectiveValues(GraphQLDeprecatedDirective, node)?.reason as string;

export type { IrisSchema };
