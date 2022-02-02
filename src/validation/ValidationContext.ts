import type { DocumentNode } from '../language/ast';
import type { ASTVisitor } from '../language/visitor';

import type {
  IrisArgument,
  IrisField,
  IrisResolverType,
  IrisStrictType,
  IrisType,
  IrisVariant,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import type { IrisSchema } from '../type/schema';

import type { GraphQLError } from '../error';
import type { Maybe } from '../utils/type-level';

import type { TypeInfo } from './TypeInfo';

/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 */
export class ASTValidationContext {
  private _ast: DocumentNode;
  private _onError: (error: GraphQLError) => void;

  constructor(ast: DocumentNode, onError: (error: GraphQLError) => void) {
    this._ast = ast;
    this._onError = onError;
  }

  get [Symbol.toStringTag]() {
    return 'ASTValidationContext';
  }

  reportError(error: GraphQLError): void {
    this._onError(error);
  }

  getDocument(): DocumentNode {
    return this._ast;
  }
}

export type ASTValidationRule = (context: ASTValidationContext) => ASTVisitor;

export class SDLValidationContext extends ASTValidationContext {
  private _schema: Maybe<IrisSchema>;

  constructor(
    ast: DocumentNode,
    schema: Maybe<IrisSchema>,
    onError: (error: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
  }

  get [Symbol.toStringTag]() {
    return 'SDLValidationContext';
  }

  getSchema(): Maybe<IrisSchema> {
    return this._schema;
  }
}

export type SDLValidationRule = (context: SDLValidationContext) => ASTVisitor;

export class ValidationContext extends ASTValidationContext {
  private _schema: IrisSchema;
  private _typeInfo: TypeInfo;

  constructor(
    schema: IrisSchema,
    ast: DocumentNode,
    typeInfo: TypeInfo,
    onError: (error: GraphQLError) => void,
  ) {
    super(ast, onError);
    this._schema = schema;
    this._typeInfo = typeInfo;
  }

  get [Symbol.toStringTag]() {
    return 'ValidationContext';
  }

  getSchema(): IrisSchema {
    return this._schema;
  }

  getType(): Maybe<IrisType> {
    return this._typeInfo.getType();
  }

  getParentType(): Maybe<IrisResolverType> {
    return this._typeInfo.getParentType();
  }

  getInputType(): Maybe<IrisStrictType> {
    return this._typeInfo.getInputType();
  }

  getParentInputType(): Maybe<IrisStrictType> {
    return this._typeInfo.getParentInputType();
  }

  getFieldDef(): Maybe<IrisField<'resolver'>> {
    return this._typeInfo.getFieldDef();
  }

  getDirective(): Maybe<GraphQLDirective> {
    return this._typeInfo.getDirective();
  }

  getArgument(): Maybe<IrisArgument> {
    return this._typeInfo.getArgument();
  }

  getEnumValue(): Maybe<IrisVariant<'data'>> {
    return this._typeInfo.getEnumValue();
  }
}

export type ValidationRule = (context: ValidationContext) => ASTVisitor;
