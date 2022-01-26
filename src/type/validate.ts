import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';

import { GraphQLError } from '../error/GraphQLError';

import type {
  ASTNode,
  DirectiveNode,
  NameNode,
  ResolverTypeDefinitionNode,
} from '../language/ast';
import { OperationTypeNode } from '../language/ast';

import type {
  IrisDataType,
  IrisDataVariant,
  IrisDataVariantField,
  IrisResolverType,
} from './definition';
import {
  isDataType,
  isInputObjectType,
  isInputType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isResolverType,
} from './definition';
import { GraphQLDeprecatedDirective, isDirective } from './directives';
import { isIntrospectionType } from './introspection';
import type { GraphQLSchema } from './schema';
import { assertSchema } from './schema';

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
export function validateSchema(
  schema: GraphQLSchema,
): ReadonlyArray<GraphQLError> {
  // First check to ensure the provided value is in fact a GraphQLSchema.
  assertSchema(schema);

  // If this Schema has already been validated, return the previous results.
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }

  // Validate the schema, producing a list of errors.
  const context = new SchemaValidationContext(schema);
  validateRootTypes(context);
  validateDirectives(context);
  validateTypes(context);

  // Persist the results of validation before returning to ensure validation
  // does not run multiple times for this schema.
  const errors = context.getErrors();
  schema.__validationErrors = errors;
  return errors;
}

/**
 * Utility function which asserts a schema is valid by throwing an error if
 * it is invalid.
 */
export function assertValidSchema(schema: GraphQLSchema): void {
  const errors = validateSchema(schema);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}

class SchemaValidationContext {
  readonly _errors: Array<GraphQLError>;
  readonly schema: GraphQLSchema;

  constructor(schema: GraphQLSchema) {
    this._errors = [];
    this.schema = schema;
  }

  reportError(
    message: string,
    nodes?: ReadonlyArray<Maybe<ASTNode>> | Maybe<ASTNode>,
  ): void {
    const _nodes = Array.isArray(nodes)
      ? (nodes.filter(Boolean) as ReadonlyArray<ASTNode>)
      : (nodes as Maybe<ASTNode>);
    this._errors.push(new GraphQLError(message, _nodes));
  }

  getErrors(): ReadonlyArray<GraphQLError> {
    return this._errors;
  }
}

function validateRootTypes(context: SchemaValidationContext): void {
  const schema = context.schema;
  const queryType = schema.getQueryType();
  if (!queryType) {
    context.reportError('Query root type must be provided.', schema.astNode);
  } else if (!isObjectType(queryType)) {
    context.reportError(
      `Query root type must be Object type, it cannot be ${inspect(
        queryType,
      )}.`,
      getOperationTypeNode(schema, OperationTypeNode.QUERY) ??
        (queryType as any).astNode,
    );
  }

  const mutationType = schema.getMutationType();
  if (mutationType && !isObjectType(mutationType)) {
    context.reportError(
      'Mutation root type must be Object type if provided, it cannot be ' +
        `${inspect(mutationType)}.`,
      getOperationTypeNode(schema, OperationTypeNode.MUTATION) ??
        (mutationType as any).astNode,
    );
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !isObjectType(subscriptionType)) {
    context.reportError(
      'Subscription root type must be Object type if provided, it cannot be ' +
        `${inspect(subscriptionType)}.`,
      getOperationTypeNode(schema, OperationTypeNode.SUBSCRIPTION) ??
        (subscriptionType as any).astNode,
    );
  }
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  operation: OperationTypeNode,
): Maybe<ASTNode> {
  return [schema.astNode]
    .flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (schemaNode) => /* c8 ignore next */ schemaNode?.operationTypes ?? [],
    )
    .find((operationNode) => operationNode.operation === operation)?.type;
}

function validateDirectives(context: SchemaValidationContext): void {
  for (const directive of context.schema.getDirectives()) {
    // Ensure all directives are in fact GraphQL directives.
    if (!isDirective(directive)) {
      context.reportError(
        `Expected directive but got: ${inspect(directive)}.`,
        (directive as any)?.astNode,
      );
      continue;
    }

    // Ensure they are named correctly.
    validateName(context, directive);

    // TODO: Ensure proper locations.

    // Ensure the arguments are valid.
    for (const arg of directive.args) {
      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure the type is an input type.
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of @${directive.name}(${arg.name}:) must be Input Type ` +
            `but got: ${inspect(arg.type)}.`,
          arg.astNode,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(
          `Required argument @${directive.name}(${arg.name}:) cannot be deprecated.`,
          [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        );
      }
    }
  }
}

function validateName(
  context: SchemaValidationContext,
  node: { readonly name: string; readonly astNode?: Maybe<ASTNode> },
): void {
  // Ensure names are valid, however introspection types opt out.
  if (node.name.startsWith('__')) {
    context.reportError(
      `Name "${node.name}" must not begin with "__", which is reserved by GraphQL introspection.`,
      node.astNode,
    );
  }
}

function validateTypes(context: SchemaValidationContext): void {
  const validateInputObjectCircularRefs =
    createInputObjectCircularRefsValidator(context);
  const typeMap = context.schema.getTypeMap();
  for (const type of Object.values(typeMap)) {
    // Ensure all provided types are in fact GraphQL type.
    if (!isNamedType(type)) {
      context.reportError(
        `Expected GraphQL named type but got: ${inspect(type)}.`,
        (type as any).astNode,
      );
      continue;
    }

    // Ensure it is named correctly (excluding introspection types).
    if (!isIntrospectionType(type)) {
      validateName(context, type);
    }

    if (isResolverType(type)) {
      validateResolverType(context, type);
    }

    if (isDataType(type)) {
      validateDataType(context, type);
      validateInputObjectCircularRefs(type);
    }
  }
}

const validateResolverType = (
  context: SchemaValidationContext,
  type: IrisResolverType,
) => {
  if (type.isVariantType()) {
    return validateFields(context, type);
  }
  validateUnionMembers(context, type);
};

function validateFields(
  context: SchemaValidationContext,
  type: IrisResolverType,
): void {
  const fields = Object.values(type.getResolverFields());

  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an output type
    if (!isOutputType(field.type)) {
      context.reportError(
        `The type of ${type.name}.${field.name} must be Output Type ` +
          `but got: ${inspect(field.type)}.`,
        field.astNode?.type,
      );
    }

    // Ensure the arguments are valid
    for (const arg of field.args) {
      const argName = arg.name;

      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure the type is an input type
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of ${type.name}.${field.name}(${argName}:) must be Input ` +
            `Type but got: ${inspect(arg.type)}.`,
          arg.astNode?.type,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(
          `Required argument ${type.name}.${field.name}(${argName}:) cannot be deprecated.`,
          [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        );
      }
    }
  }
}

function validateUnionMembers(
  context: SchemaValidationContext,
  adt: IrisResolverType,
): void {
  const listedMembers: Record<string, boolean> = {};

  adt.getTypes().forEach((memberType) => {
    if (listedMembers[memberType.name]) {
      return context.reportError(
        `Union type ${adt.name} can only include type ${memberType.name} once.`,
        getResolverVariantNames(adt, memberType.name),
      );
    }
    listedMembers[memberType.name] = true;
    if (!isObjectType(memberType)) {
      context.reportError(
        `Union type ${adt.name} can only include Object types, ` +
          `it cannot include ${inspect(memberType)}.`,
        getResolverVariantNames(adt, String(memberType)),
      );
    }
  });
}

const validateDataType = (
  context: SchemaValidationContext,
  type: IrisDataType,
): void => {
  type.getVariants().forEach((variant) => {
    validateName(context, variant);
    validateDataFields(context, variant);
  });
};

function validateDataFields(
  context: SchemaValidationContext,
  variant: IrisDataVariant,
): void {
  const fields = Object.values(variant.fields ?? {});

  // Ensure the arguments are valid
  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an input type
    if (!isInputType(field.type)) {
      context.reportError(
        `The type of ${variant.name}.${field.name} must be Input Type ` +
          `but got: ${inspect(field.type)}.`,
        field.astNode?.type,
      );
    }

    if (isRequiredInputField(field) && field.deprecationReason != null) {
      context.reportError(
        `Required input field ${variant.name}.${field.name} cannot be deprecated.`,
        [getDeprecatedDirectiveNode(field.astNode), field.astNode?.type],
      );
    }
  }
}

function createInputObjectCircularRefsValidator(
  context: SchemaValidationContext,
): (inputObj: IrisDataType) => void {
  // Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
  // Tracks already visited types to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  const visitedTypes = Object.create(null);

  // Array of types nodes used to produce meaningful errors
  const fieldPath: Array<IrisDataVariantField> = [];

  // Position in the type path
  const fieldPathIndexByTypeName = Object.create(null);

  return detectCycleRecursive;

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
  function detectCycleRecursive(inputObj: IrisDataType): void {
    if (visitedTypes[inputObj.name]) {
      return;
    }

    visitedTypes[inputObj.name] = true;
    fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;

    inputObj.getVariants().forEach((variant) => {
      const fields = Object.values(variant.fields ?? {});
      for (const field of fields) {
        if (isNonNullType(field.type) && isInputObjectType(field.type.ofType)) {
          const fieldType = field.type.ofType;
          const cycleIndex = fieldPathIndexByTypeName[fieldType.name];

          fieldPath.push(field);
          if (cycleIndex === undefined) {
            detectCycleRecursive(fieldType);
          } else {
            const cyclePath = fieldPath.slice(cycleIndex);
            const pathStr = cyclePath
              .map((fieldObj) => fieldObj.name)
              .join('.');
            context.reportError(
              `Cannot reference Input Object "${fieldType.name}" within itself through a series of non-null fields: "${pathStr}".`,
              cyclePath.map((fieldObj) => fieldObj.astNode),
            );
          }
          fieldPath.pop();
        }
      }
    });

    fieldPathIndexByTypeName[inputObj.name] = undefined;
  }
}

function getResolverVariantNames(
  union: IrisResolverType,
  typeName: string,
): Maybe<ReadonlyArray<NameNode>> {
  const { astNode } = union;
  const nodes: ReadonlyArray<ResolverTypeDefinitionNode> =
    astNode != null ? [astNode] : [];

  return nodes
    .flatMap(
      (unionNode) =>
        /* c8 ignore next */ unionNode.variants?.map((x) => x.name) ?? [],
    )
    .filter((typeNode) => typeNode.value === typeName);
}

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{ readonly directives?: ReadonlyArray<DirectiveNode> }>,
): Maybe<DirectiveNode> {
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
