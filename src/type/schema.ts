import type { ParseOptions, Source } from 'graphql';
import { uniqBy } from 'ramda';

import type {
  ArgumentDefinitionNode,
  DirectiveDefinitionNode,
  DocumentNode,
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
import { inspect, instanceOf } from '../utils/legacy';
import type { ObjMap } from '../utils/ObjMap';
import { keyMap } from '../utils/ObjMap';
import type { ConfigMap, IrisMaybe, Maybe } from '../utils/type-level';
import { notNill } from '../utils/type-level';

import { collectAllReferencedTypes } from './collectAllReferencedTypes';
import type {
  IrisArgument,
  IrisFieldConfig,
  IrisNamedType,
  IrisType,
  IrisVariantConfig,
} from './definition';
import { IrisTypeDefinition, IrisTypeRef } from './definition';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  specifiedDirectives,
} from './directives';
import { specifiedScalarTypes } from './scalars';

/**
 * Test if the given value is a GraphQL schema.
 */
export function isSchema(schema: unknown): schema is IrisSchema {
  return instanceOf(schema, IrisSchema);
}

export function assertSchema(schema: unknown): IrisSchema {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }
  return schema;
}

export class IrisSchema {
  description: Maybe<string>;

  readonly query?: IrisTypeDefinition<'resolver'>;
  readonly mutation?: IrisTypeDefinition<'resolver'>;
  readonly subscription?: IrisTypeDefinition<'resolver'>;
  readonly directives: ReadonlyArray<GraphQLDirective>;
  readonly typeMap: TypeMap;

  // Used as a cache for validateSchema().
  __validationErrors: Maybe<ReadonlyArray<IrisError>>;

  constructor(config: Readonly<IrisSchemaConfig>) {
    this.__validationErrors = config.assumeValid === true ? [] : undefined;
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

export type IrisSchemaValidationOptions = {
  assumeValid?: boolean;
  assumeValidSDL?: boolean;
};

export interface IrisSchemaConfig extends IrisSchemaValidationOptions {
  description?: Maybe<string>;
  query?: Maybe<IrisTypeDefinition<'resolver'>>;
  mutation?: Maybe<IrisTypeDefinition<'resolver'>>;
  subscription?: Maybe<IrisTypeDefinition<'resolver'>>;
  types?: Maybe<ReadonlyArray<IrisNamedType>>;
  directives?: Maybe<ReadonlyArray<GraphQLDirective>>;
}

export function buildSchema(
  source: string | Source,
  options?: IrisSchemaValidationOptions & ParseOptions,
): IrisSchema {
  const document = parse(source, { noLocation: options?.noLocation });

  return buildASTSchema(document, { ...options });
}

export function buildASTSchema(
  documentAST: DocumentNode,
  options?: IrisSchemaValidationOptions,
): IrisSchema {
  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    const errors = validateSDL(documentAST);
    if (errors.length !== 0) {
      throw new Error(errors.map((error) => error.message).join('\n\n'));
    }
  }

  const directiveDefs: Array<DirectiveDefinitionNode> = [];
  const typeMap: Record<string, IrisNamedType> = {};

  function getNamedType<R extends Role>(
    node: NamedTypeNode | VariantDefinitionNode<R>,
  ): IrisNamedType<R> {
    const name = node.name.value;
    const type = stdTypeMap[name] ?? typeMap[name];

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
      args: buildArgumentMap(node.arguments),
      astNode: node,
    });
  }

  function buildArgumentMap(
    argsNodes: IrisMaybe<ReadonlyArray<ArgumentDefinitionNode>> = [],
  ): ConfigMap<IrisArgument> {
    const argConfigMap: ConfigMap<IrisArgument> = {};
    for (const astNode of argsNodes) {
      const type: any = getWrappedType(astNode.type);
      argConfigMap[astNode.name.value] = {
        type,
        description: astNode.description?.value,
        defaultValue: valueFromAST(astNode.defaultValue, type),
        deprecationReason: getDeprecationReason(astNode),
        astNode,
      };
    }
    return argConfigMap;
  }

  const buildField = <R extends Role>(
    field: FieldDefinitionNode<R>,
  ): IrisFieldConfig<R> =>
    ({
      type: getWrappedType(field.type),
      description: field.description?.value,
      deprecationReason: getDeprecationReason(field),
      astNode: field,
      args: field.arguments ? buildArgumentMap(field.arguments) : undefined,
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
        typeMap[name] = stdTypeMap[name] ?? buildType(def);
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
    assumeValid: options?.assumeValid ?? false,
  });
}

const stdTypeMap = keyMap([...specifiedScalarTypes], (type) => type.name);

const getDeprecationReason = (
  node:
    | FieldDefinitionNode<Role>
    | ArgumentDefinitionNode
    | VariantDefinitionNode<Role>,
): Maybe<string> =>
  getDirectiveValues(GraphQLDeprecatedDirective, node)?.reason as string;
