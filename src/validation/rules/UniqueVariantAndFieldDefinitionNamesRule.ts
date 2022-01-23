import { GraphQLError } from '../../error/GraphQLError';

import type {
  DataTypeDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NameNode,
  ResolverTypeDefinitionNode,
} from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { GraphQLNamedType } from '../../type/definition';
import { isInputObjectType, isObjectType } from '../../type/definition';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique field definition names
 *
 * A GraphQL complex type is only valid if all its fields are uniquely named.
 */
export function UniqueVariantAndFieldDefinitionNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
  const knownFieldNames = Object.create(null);

  return {
    DataTypeDefinition: checkVariantUniqueness,
    ResolverTypeDefinition: checkVariantUniqueness,
  };

  function checkVariantUniqueness({ variants, name }: DataTypeDefinitionNode | ResolverTypeDefinitionNode) {
    const knownVariantNames: Record<string, NameNode> = {};
    const typeName = name.value;

    for (const variant of variants) {
      const variantName = variant.name.value;

      if (knownVariantNames[variantName]) {
        context.reportError(
          new GraphQLError(
            `Variant "${typeName}.${variantName}" can only be defined once.`,
            [knownVariantNames[variantName], variant.name],
          ),
        );
      } else {
        checkFieldUniqueness(variant);
        knownVariantNames[variantName] = variant.name;
      }
    }

    return false;
  }

  function checkFieldUniqueness(node: {
    readonly name: NameNode;
    readonly fields?: ReadonlyArray<
      InputValueDefinitionNode | FieldDefinitionNode
    >;
  }) {
    const typeName = node.name.value;

    if (!knownFieldNames[typeName]) {
      knownFieldNames[typeName] = Object.create(null);
    }

    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    /* c8 ignore next */
    const fieldNodes = node.fields ?? [];
    const fieldNames = knownFieldNames[typeName];

    for (const fieldDef of fieldNodes) {
      const fieldName = fieldDef.name.value;

      if (hasField(existingTypeMap[typeName], fieldName)) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
            fieldDef.name,
          ),
        );
      } else if (fieldNames[fieldName]) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" can only be defined once.`,
            [fieldNames[fieldName], fieldDef.name],
          ),
        );
      } else {
        fieldNames[fieldName] = fieldDef.name;
      }
    }

    return false;
  }
}

function hasField(type: GraphQLNamedType, fieldName: string): boolean {
  if (isObjectType(type) || isInputObjectType(type)) {
    return type.getFields()[fieldName] != null;
  }
  return false;
}
