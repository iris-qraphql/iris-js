import type { IrisError } from '../error';
import { irisNodeError } from '../error';
import type { ASTNode, DirectiveNode } from '../types/ast';
import { isInputType, isRequiredArgument } from '../types/definition';
import { GraphQLDeprecatedDirective, isDirective } from '../types/directives';
import type { IrisSchema } from '../types/schema';
import { inspect } from '../utils/legacy';
import type { Maybe } from '../utils/type-level';

export function validateSchema(schema: IrisSchema): ReadonlyArray<IrisError> {
  // If this Schema has already been validated, return the previous results.
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }

  // Validate the schema, producing a list of errors.
  const context = new SchemaValidationContext(schema);
  validateRootTypes(context);
  validateDirectives(context);

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
    if (type && !(type.role === 'resolver' && type.isVariantType)) {
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

    // Ensure the arguments are valid.
    for (const arg of directive.args) {
      // Ensure they are named correctly.

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

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{ readonly directives?: ReadonlyArray<DirectiveNode> }>,
): Maybe<DirectiveNode> {
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
