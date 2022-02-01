import { OperationTypeNode } from 'graphql';

import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';

import type { ASTNode, DirectiveNode } from '../language/ast';

import { GraphQLError } from '../error';

import type {
  IrisDataType,
  IrisDataVariant,
  IrisField,
  IrisResolverType,
  IrisResolverVariant,
} from './definition';
import {
  isDataType,
  isInputType,
  isObjectType,
  isRequiredArgument,
  isResolverType,
  isType,
  isTypeRef,
} from './definition';
import { GraphQLDeprecatedDirective, isDirective } from './directives';
import type { IrisSchema } from './schema';
import { assertSchema } from './schema';

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
export function validateSchema(
  schema: IrisSchema,
): ReadonlyArray<GraphQLError> {
  // First check to ensure the provided value is in fact a IrisSchema.
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

class SchemaValidationContext {
  readonly _errors: Array<GraphQLError>;
  readonly schema: IrisSchema;

  constructor(schema: IrisSchema) {
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
    context.reportError('Query root type must be provided.');
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
  _schema: IrisSchema,
  _operation: OperationTypeNode,
): Maybe<ASTNode> {
  return undefined;
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

function validateTypes(ctx: SchemaValidationContext): void {
  Object.values(ctx.schema.getTypeMap()).forEach((type) => {
    if (isResolverType(type)) {
      return validateResolverType(ctx, type);
    }
    if (isDataType(type)) {
      return validateDataType(ctx, type);
    }

    return ctx.reportError(
      `Expected GraphQL named type but got: ${inspect(type)}.`,
      (type as any).astNode,
    );
  });
}

const validateResolverType = (
  context: SchemaValidationContext,
  type: IrisResolverType,
) => {
  const variants = type.variants();
  if (type.isVariantType()) {
    return validateFields(
      type.name,
      context,
      Object.values(variants[0]?.fields ?? {}),
    );
  }
  return validateUnionMembers(type.name, context, variants);
};

function validateFields(
  typeName: string,
  context: SchemaValidationContext,
  fields: ReadonlyArray<IrisField>,
): void {
  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an output type
    if (!isType(field.type)) {
      context.reportError(
        `The type of ${typeName}.${field.name} must be Output Type ` +
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
          `The type of ${typeName}.${field.name}(${argName}:) must be Input ` +
            `Type but got: ${inspect(arg.type)}.`,
          arg.astNode?.type,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(
          `Required argument ${typeName}.${field.name}(${argName}:) cannot be deprecated.`,
          [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        );
      }
    }
  }
}

function validateUnionMembers(
  typeName: string,
  context: SchemaValidationContext,
  variants: ReadonlyArray<IrisResolverVariant>,
): void {
  const listedMembers: Record<string, boolean> = {};

  variants.forEach(({ name, astNode, type }) => {
    if (listedMembers[name]) {
      return context.reportError(
        `Union type ${typeName} can only include type ${name} once.`,
        astNode?.name,
      );
    }

    if (!type) {
      // variants are valid records
      return;
    }

    listedMembers[name] = true;
    if (!type?.isVariantType?.() || isDataType(type) || isTypeRef(type)) {
      context.reportError(
        `Union type ${typeName} can only include Object types, ` +
          `it cannot include ${inspect(type)}.`,
        astNode?.name,
      );
    }
  });
}

const validateDataType = (
  context: SchemaValidationContext,
  type: IrisDataType,
): void => {
  type.variants().forEach((variant) => {
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
  }
}

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{ readonly directives?: ReadonlyArray<DirectiveNode> }>,
): Maybe<DirectiveNode> {
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
