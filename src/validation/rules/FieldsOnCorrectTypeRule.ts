import { didYouMean } from '../../jsutils/didYouMean';
import { naturalCompare } from '../../jsutils/naturalCompare';
import { suggestionList } from '../../jsutils/suggestionList';

import { GraphQLError } from '../../error/GraphQLError';

import type { FieldNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type {
  GraphQLOutputType,
  IrisResolverType,
} from '../../type/definition';
import { isObjectType, isUnionType } from '../../type/definition';
import type { GraphQLSchema } from '../../type/schema';

import type { ValidationContext } from '../ValidationContext';

/**
 * Fields on correct type
 *
 * A GraphQL document is only valid if all fields selected are defined by the
 * parent type, or are an allowed meta field such as __typename.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selections
 */
export function FieldsOnCorrectTypeRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Field(node: FieldNode) {
      const type = context.getParentType();
      if (type) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          // This field doesn't exist, lets look for suggestions.
          const schema = context.getSchema();
          const fieldName = node.name.value;

          // First determine if there are any suggested types to condition on.
          let suggestion = didYouMean(
            'to use an inline fragment on',
            getSuggestedTypeNames(schema, type, fieldName),
          );

          // If there are no suggested types, then perhaps this was a typo?
          if (suggestion === '') {
            suggestion = didYouMean(getSuggestedFieldNames(type, fieldName));
          }

          // Report an error, including helpful suggestions.
          context.reportError(
            new GraphQLError(
              `Cannot query field "${fieldName}" on type "${type.name}".` +
                suggestion,
              node,
            ),
          );
        }
      }
    },
  };
}

/**
 * Go through all of the implementations of type, as well as the interfaces that
 * they implement. If any of those types include the provided field, suggest them,
 * sorted by how often the type is referenced.
 */
function getSuggestedTypeNames(
  schema: GraphQLSchema,
  type: GraphQLOutputType,
  fieldName: string,
): Array<string> {
  if (!isUnionType(type)) {
    // Must be an Object type, which does not have possible fields.
    return [];
  }

  const suggestedTypes: Set<IrisResolverType> = new Set();
  const usageCount = Object.create(null);
  for (const possibleType of schema.getPossibleTypes(type)) {
    if (!possibleType.getResolverFields()[fieldName]) {
      continue;
    }

    // This object type defines this field.
    suggestedTypes.add(possibleType);
    usageCount[possibleType.name] = 1;
  }

  return [...suggestedTypes]
    .sort((typeA, typeB) => {
      // Suggest both interface and object types based on how common they are.
      const usageCountDiff = usageCount[typeB.name] - usageCount[typeA.name];
      if (usageCountDiff !== 0) {
        return usageCountDiff;
      }

      return naturalCompare(typeA.name, typeB.name);
    })
    .map((x) => x.name);
}

/**
 * For the field name provided, determine if there are any similar field names
 * that may be the result of a typo.
 */
function getSuggestedFieldNames(
  type: GraphQLOutputType,
  fieldName: string,
): Array<string> {
  if (isObjectType(type)) {
    const possibleFieldNames = Object.keys(type.getResolverFields());
    return suggestionList(fieldName, possibleFieldNames);
  }
  // Otherwise, must be a Union type, which does not define fields.
  return [];
}
