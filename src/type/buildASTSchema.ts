import type { ParseOptions, Source } from 'graphql';

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
import { isTypeDefinitionNode } from '../language/predicates';

import { validateSDL } from '../validation/validate';

import { valueFromAST } from '../conversion/valueFromAST';
import { getDirectiveValues } from '../conversion/values';
import { keyMap } from '../utils/ObjMap';
import type { ConfigMap, IrisMaybe, Maybe } from '../utils/type-level';

import type {
  IrisArgument,
  IrisFieldConfig,
  IrisNamedType,
  IrisType,
  IrisVariantConfig,
} from './definition';
import { IrisTypeDefinition, IrisTypeRef } from './definition';
import { GraphQLDeprecatedDirective, GraphQLDirective } from './directives';
import { specifiedScalarTypes } from './scalars';
import type { IrisSchemaValidationOptions } from './schema';
import { IrisSchema } from './schema';

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
