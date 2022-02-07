import type {
  _FieldDefinitionNode,
  ArgumentDefinitionNode,
  DataTypeDefinitionNode,
  NameNode,
  ResolverTypeDefinitionNode,
  Role,
} from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import { irisNodeError } from '../../error';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique field definition names
 *
 * A GraphQL complex type is only valid if all its fields are uniquely named.
 */
export function UniqueVariantAndFieldDefinitionNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const knownFieldNames = Object.create(null);

  return {
    DataTypeDefinition: checkVariantUniqueness,
    ResolverTypeDefinition: checkVariantUniqueness,
  };

  function checkVariantUniqueness({
    variants,
    name,
  }: DataTypeDefinitionNode | ResolverTypeDefinitionNode) {
    const knownVariantNames: Record<string, NameNode> = {};
    const typeName = name.value;

    for (const variant of variants) {
      const variantName = variant.name.value;

      if (knownVariantNames[variantName]) {
        context.reportError(
          irisNodeError(
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
      ArgumentDefinitionNode | _FieldDefinitionNode<Role>
    >;
  }) {
    const typeName = node.name.value;

    if (!knownFieldNames[typeName]) {
      knownFieldNames[typeName] = Object.create(null);
    }

    const fieldNodes = node.fields ?? [];
    const fieldNames = knownFieldNames[typeName];

    for (const fieldDef of fieldNodes) {
      const fieldName = fieldDef.name.value;

      if (fieldNames[fieldName]) {
        context.reportError(
          irisNodeError(
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
