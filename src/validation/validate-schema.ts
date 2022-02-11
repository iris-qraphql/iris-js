import type { ASTNode, DirectiveNode } from '../language/ast';

import type {
  IrisField,
  IrisTypeDefinition,
  IrisVariant,
} from '../type/definition';
import {
  isInputType,
  isRequiredArgument,
  isType,
  isTypeRef,
} from '../type/definition';
import { GraphQLDeprecatedDirective, isDirective } from '../type/directives';
import type { IrisSchema } from '../type/schema';

import type { IrisError } from '../error';
import { irisNodeError } from '../error';
import { inspect } from '../utils/legacy';
import type { Maybe } from '../utils/type-level';

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
export function validateSchema(schema: IrisSchema): ReadonlyArray<IrisError> {
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
  readonly _errors: Array<IrisError>;
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
    this._errors.push(irisNodeError(message, _nodes));
  }

  getErrors(): ReadonlyArray<IrisError> {
    return this._errors;
  }
}

function validateRootTypes(context: SchemaValidationContext): void {
  const schema = context.schema;

  if (!schema.query) {
    context.reportError('Query root type must be provided.');
  }

  const roots = {
    Query: schema.query,
    Mutation: schema.mutation,
    Subscription: schema.subscription,
  };

  for (const [operation, type] of Object.entries(roots)) {
    if (type && !(type.role === 'resolver' && type.isVariantType())) {
      context.reportError(
        `${operation} root type must be Object type${
          operation === 'Query' ? '' : ' if provided'
        }, it cannot be ${inspect(type)}.`,
        type.astNode,
      );
    }
  }
}

function validateDirectives(context: SchemaValidationContext): void {
  for (const directive of context.schema.directives) {
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
  Object.values(ctx.schema.typeMap).forEach((type) => {
    switch (type.role) {
      case 'resolver':
        return validateResolverType(
          ctx,
          type as IrisTypeDefinition<'resolver'>,
        );
      case 'data':
        return validateDataType(ctx, type as IrisTypeDefinition<'data'>);
    }
  });
}

const validateResolverType = (
  context: SchemaValidationContext,
  type: IrisTypeDefinition<'resolver'>,
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
  fields: ReadonlyArray<IrisField<'resolver'>>,
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
    for (const arg of field.args ?? []) {
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
  variants: ReadonlyArray<IrisVariant<'resolver'>>,
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
    if (
      !type?.isVariantType?.() ||
      type.role !== 'resolver' ||
      isTypeRef(type)
    ) {
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
  type: IrisTypeDefinition<'data'>,
): void => {
  type.variants().forEach((variant) => {
    validateName(context, variant);
    validateDataFields(context, variant);
  });
};

function validateDataFields(
  context: SchemaValidationContext,
  variant: IrisVariant<'data'>,
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
