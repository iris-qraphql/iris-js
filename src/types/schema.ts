import type { DirectiveNode, ParseOptions, Source } from 'graphql';
import { prop, uniqBy } from 'ramda';

import { typeCheckASTValue } from '../validation/typeCheckASTValue';
import { validateSDL } from '../validation/validate';

import { parse } from '../parsing';
import type { TypeMap } from '../utils/collectTypeMap';
import { collectTypeMap } from '../utils/collectTypeMap';
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
  IrisTypeRef,
  IrisVariant,
} from './definition';
import {
  IrisScalars,
  IrisTypeDefinition,
  irisTypeRef,
  liftType,
} from './definition';
import {
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  specifiedDirectives,
} from './directives';
import { IrisKind } from './kinds';

export const getType = (
  schema: IrisSchema,
  name: string,
): IrisMaybe<IrisTypeDefinition> => schema.types[name];

export const getDirective = (
  schema: IrisSchema,
  name: string,
): Maybe<GraphQLDirective> =>
  schema.directives.find((directive) => directive.name === name);

type IrisSchema = {
  readonly directives: ReadonlyArray<GraphQLDirective>;
  readonly types: TypeMap;
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

  function getWrappedType<R extends Role>(node: TypeNode): IrisTypeRef<R> {
    switch (node.kind) {
      case IrisKind.LIST_TYPE:
        return irisTypeRef('LIST', getWrappedType(node.type));
      case IrisKind.MAYBE_TYPE:
        return irisTypeRef('MAYBE', getWrappedType(node.type));
      case IrisKind.NAMED_TYPE:
        return irisTypeRef('NAMED', lookupType(node));
    }
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
  ): IrisField<R> => {
    const type = getWrappedType(field.type) as IrisField<R>['type'];
    const args = field.arguments?.map(buildArgument) as IrisField<R>['args'];

    return {
      name: field.name.value,
      type,
      description: field.description?.value,
      deprecationReason: getDeprecationReason(field),
      astNode: field,
      args,
      toJSON: () => field.name.value,
    };
  };

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

  const directives = uniqBy(prop('name'), [
    ...directiveDefs.map(buildDirective),
    ...specifiedDirectives,
  ]);

  return {
    types: collectTypeMap(
      [
        typeMap.Query,
        typeMap.Mutation,
        typeMap.Subscription,
        ...Object.values(typeMap),
      ].filter(notNill),
      directives,
    ),
    directives,
  };
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

  return (
    (typeCheckASTValue(reason, liftType(IrisScalars.String)) as string) ?? ''
  );
}

export type { IrisSchema };
