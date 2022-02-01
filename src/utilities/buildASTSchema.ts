import type { ParseOptions, Source } from 'graphql';

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
import { parse } from '../language/parser';
import { isTypeDefinitionNode } from '../language/predicates';

import type {
  GraphQLArgument,
  GraphQLFieldConfig,
  IrisDataVariantConfig,
  IrisDataVariantField,
  IrisNamedType,
  IrisResolverVariantConfig,
  IrisType,
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
import type { IrisSchemaValidationOptions } from '../type/schema';
import { IrisSchema } from '../type/schema';

import { validateSDL } from '../validation/validate';

import type { ConfigMap } from '../utils/type-level';

import { valueFromAST } from './valueFromAST';
import { getDirectiveValues } from './values';

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

  documentAST.definitions.forEach((def) => {
    if (isTypeDefinitionNode(def)) {
      const name = def.name.value;
      typeMap[name] = stdTypeMap[name] ?? buildType(def);
    } else if (def.kind === IrisKind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  });

  return new IrisSchema({
    description: undefined,
    types: Object.values(typeMap),
    query: typeMap.Query as IrisResolverType,
    mutation: typeMap.Mutation as IrisResolverType,
    subscription: typeMap.Subscription as IrisResolverType,
    directives: directiveDefs.map(buildDirective),
    assumeValid: options?.assumeValid ?? false,
  });

  function getNamedType(node: NamedTypeNode): IrisNamedType {
    const name = node.name.value;
    const type = stdTypeMap[name] ?? typeMap[name];

    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }
    return type;
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

const getDeprecationReason = (
  node: FieldDefinitionNode | ArgumentDefinitionNode | VariantDefinitionNode,
): Maybe<string> =>
  getDirectiveValues(GraphQLDeprecatedDirective, node)?.reason as string;
