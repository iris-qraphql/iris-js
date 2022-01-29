import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import { keyMap } from '../jsutils/ObjMap';

import type {
  ArgumentDefinitionNode,
  DataFieldDefinitionNode,
  DirectiveDefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  NamedTypeNode,
  ResolverVariantDefinitionNode,
  TypeDefinitionNode,
  TypeNode,
  VariantDefinitionNode,
} from '../language/ast';
import { IrisKind } from '../language/kinds';
import { isTypeDefinitionNode } from '../language/predicates';

import type {
  GraphQLArgument,
  GraphQLFieldConfig,
  GraphQLType,
  IrisDataVariantConfig,
  IrisDataVariantField,
  IrisNamedType,
  IrisResolverVariantConfig,
} from '../type/definition';
import {
  IrisDataType,
  IrisResolverType,
  IrisTypeRef,
} from '../type/definition';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
} from '../type/directives';
import { specifiedScalarTypes } from '../type/scalars';
import type {
  GraphQLSchemaNormalizedConfig,
  GraphQLSchemaValidationOptions,
} from '../type/schema';

import type { ConfigMap } from '../utils/type-level';

import { valueFromAST } from './valueFromAST';
import { getDirectiveValues } from './values';

interface Options extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean;
}

/**
 * Produces a new schema given an existing schema and a document which may
 * contain GraphQL type extensions and definitions. The original schema will
 * remain unaltered.
 *
 * Because a schema represents a graph of references, a schema cannot be
 * extended without effectively making an entire copy. We do not know until it's
 * too late if subgraphs remain unchanged.
 *
 * This algorithm copies the provided schema, applying extensions while
 * producing the copy. The original schema remains unaltered.
 */

/**
 * @internal
 */
export function extendSchemaImpl(
  schemaConfig: GraphQLSchemaNormalizedConfig,
  documentAST: DocumentNode,
  options?: Options,
): GraphQLSchemaNormalizedConfig {
  // Collect the type definitions and extensions found in the document.
  const typeDefs: Array<TypeDefinitionNode> = [];
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  // Schema extensions are collected which may add additional operation types.

  for (const def of documentAST.definitions) {
    if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (def.kind === IrisKind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }

  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (
    Object.keys(typeExtensionsMap).length === 0 &&
    typeDefs.length === 0 &&
    directiveDefs.length === 0
  ) {
    return schemaConfig;
  }

  const typeMap = Object.create(null);
  for (const existingType of schemaConfig.types) {
    typeMap[existingType.name] = existingType;
  }

  for (const typeNode of typeDefs) {
    const name = typeNode.name.value;
    typeMap[name] = stdTypeMap[name] ?? buildType(typeNode);
  }

  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription:
      schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
  };

  // Then produce and return a Schema config with these types.
  return {
    description: undefined,
    ...operationTypes,
    types: Object.values(typeMap),
    directives: [
      ...schemaConfig.directives,
      ...directiveDefs.map(buildDirective),
    ],
    extensions: Object.create(null),
    assumeValid: options?.assumeValid ?? false,
  };

  function replaceNamedType<T extends IrisNamedType>(type: T): T {
    // Note: While this could make early assertions to get the correctly
    // typed values, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return typeMap[type.name];
  }

  function getNamedType(node: NamedTypeNode): IrisNamedType {
    const name = node.name.value;
    const type = stdTypeMap[name] ?? typeMap[name];

    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }
    return type;
  }

  function getWrappedType(node: TypeNode): GraphQLType {
    if (node.kind === IrisKind.LIST_TYPE) {
      return new IrisTypeRef('LIST', getWrappedType(node.type));
    }
    if (node.kind === IrisKind.NON_NULL_TYPE) {
      return getWrappedType(node.type);
    }
    if (node.kind === IrisKind.MAYBE) {
      return new IrisTypeRef('MAYBE', getWrappedType(node.type));
    }
    return getNamedType(node);
  }

  function buildDirective(node: DirectiveDefinitionNode): GraphQLDirective {
    return new GraphQLDirective({
      name: node.name.value,
      description: node.description?.value,
      // @ts-expect-error
      locations: node.locations.map(({ value }) => value),
      isRepeatable: node.repeatable,
      args: buildArgumentMap(node.arguments),
      astNode: node,
    });
  }

  function buildArgumentMap(
    args: Maybe<ReadonlyArray<ArgumentDefinitionNode>>,
  ): ConfigMap<GraphQLArgument> {
    const argsNodes = /* c8 ignore next */ args ?? [];

    const argConfigMap = Object.create(null);
    for (const arg of argsNodes) {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      const type: any = getWrappedType(arg.type);

      argConfigMap[arg.name.value] = {
        type,
        description: arg.description?.value,
        defaultValue: valueFromAST(arg.defaultValue, type),
        deprecationReason: getDeprecationReason(arg),
        astNode: arg,
      };
    }
    return argConfigMap;
  }

  function buildFieldMap(
    node: ReadonlyArray<FieldDefinitionNode>,
  ): ObjMap<GraphQLFieldConfig<unknown, unknown>>;
  function buildFieldMap(
    fields: ReadonlyArray<DataFieldDefinitionNode>,
  ): ObjMap<IrisDataVariantField>;
  function buildFieldMap(
    fields: ReadonlyArray<FieldDefinitionNode>,
  ): ObjMap<GraphQLFieldConfig<unknown, unknown>> {
    const entries = fields.map((field) => {
      const type: any = getWrappedType(field.type);
      return [
        field.name.value,
        {
          type,
          description: field.description?.value,
          deprecationReason: getDeprecationReason(field),
          astNode: field,
          args: field.arguments ? buildArgumentMap(field.arguments) : undefined,
        },
      ];
    });

    return Object.fromEntries(entries);
  }

  function resolveDataVariant(
    value: VariantDefinitionNode,
  ): IrisDataVariantConfig {
    return {
      name: value.name.value,
      description: value.description?.value,
      deprecationReason: getDeprecationReason(value),
      astNode: value,
      // @ts-expect-error
      fields: value.fields
        ? () => buildFieldMap(value?.fields ?? [])
        : undefined,
    };
  }

  function buildResolverVariant(
    variantNode: ResolverVariantDefinitionNode,
  ): IrisResolverVariantConfig {
    const name = variantNode.name.value;
    const description = variantNode.description?.value;

    if (variantNode.fields) {
      return {
        name,
        description,
        fields: () => buildFieldMap(variantNode.fields ?? []),
        astNode: variantNode,
      };
    }

    return {
      name,
      description,
      astNode: variantNode,
      // @ts-expect-error
      type: () => getNamedType(variantNode),
    };
  }

  function buildType(astNode: TypeDefinitionNode): IrisNamedType {
    const name = astNode.name.value;

    switch (astNode.kind) {
      case IrisKind.RESOLVER_TYPE_DEFINITION: {
        return new IrisResolverType({
          name,
          description: astNode.description?.value,
          variants: astNode.variants.map(buildResolverVariant),
          astNode,
        });
      }
      case IrisKind.DATA_TYPE_DEFINITION: {
        return new IrisDataType({
          name,
          description: astNode.description?.value,
          variants: astNode.variants.map(resolveDataVariant),
          astNode,
        });
      }
    }
  }
}

const stdTypeMap = keyMap([...specifiedScalarTypes], (type) => type.name);

/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(
  node: FieldDefinitionNode | ArgumentDefinitionNode | VariantDefinitionNode,
): Maybe<string> {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  // @ts-expect-error validated by `getDirectiveValues`
  return deprecated?.reason;
}
