import { isType, Kind } from 'graphql';

import type { Maybe } from '../jsutils/Maybe';

import type { ASTNode } from '../language/ast';
import { isNode } from '../language/ast';
import type { ASTVisitor } from '../language/visitor';
import { getEnterLeaveForKind } from '../language/visitor';

import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInputType,
  GraphQLOutputType,
  IrisDataVariant,
  IrisResolverType,
  IrisType,
} from '../type/definition';
import {
  getNamedType,
  getNullableType,
  isDataType,
  isInputType,
  isListType,
  isResolverType,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import type { IrisSchema } from '../type/schema';

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  private _schema: IrisSchema;
  private _typeStack: Array<Maybe<GraphQLOutputType>>;
  private _parentTypeStack: Array<Maybe<IrisResolverType>>;
  private _inputTypeStack: Array<Maybe<GraphQLInputType>>;
  private _fieldDefStack: Array<Maybe<GraphQLField>>;
  private _defaultValueStack: Array<Maybe<unknown>>;
  private _directive: Maybe<GraphQLDirective>;
  private _argument: Maybe<GraphQLArgument>;
  private _enumValue: Maybe<IrisDataVariant>;

  constructor(
    schema: IrisSchema,
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     *  beginning somewhere other than documents.
     */
    initialType?: Maybe<IrisType>,
  ) {
    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._defaultValueStack = [];
    this._directive = null;
    this._argument = null;
    this._enumValue = null;
    if (initialType) {
      if (isInputType(initialType)) {
        this._inputTypeStack.push(initialType);
      }
      if (isResolverType(initialType)) {
        this._parentTypeStack.push(initialType);
      }
      if (isType(initialType)) {
        this._typeStack.push(initialType);
      }
    }
  }

  get [Symbol.toStringTag]() {
    return 'TypeInfo';
  }

  getType(): Maybe<GraphQLOutputType> {
    if (this._typeStack.length > 0) {
      return this._typeStack[this._typeStack.length - 1];
    }
  }

  getParentType(): Maybe<IrisResolverType> {
    if (this._parentTypeStack.length > 0) {
      return this._parentTypeStack[this._parentTypeStack.length - 1];
    }
  }

  getInputType(): Maybe<GraphQLInputType> {
    if (this._inputTypeStack.length > 0) {
      return this._inputTypeStack[this._inputTypeStack.length - 1];
    }
  }

  getParentInputType(): Maybe<GraphQLInputType> {
    if (this._inputTypeStack.length > 1) {
      return this._inputTypeStack[this._inputTypeStack.length - 2];
    }
  }

  getFieldDef(): Maybe<GraphQLField> {
    if (this._fieldDefStack.length > 0) {
      return this._fieldDefStack[this._fieldDefStack.length - 1];
    }
  }

  getDefaultValue(): Maybe<unknown> {
    if (this._defaultValueStack.length > 0) {
      return this._defaultValueStack[this._defaultValueStack.length - 1];
    }
  }

  getDirective(): Maybe<GraphQLDirective> {
    return this._directive;
  }

  getArgument(): Maybe<GraphQLArgument> {
    return this._argument;
  }

  getEnumValue(): Maybe<IrisDataVariant> {
    return this._enumValue;
  }

  enter(node: ASTNode) {
    const schema = this._schema;
    // Note: many of the types below are explicitly typed as "unknown" to drop
    // any assumptions of a valid schema to ensure runtime types are properly
    // checked before continuing since TypeInfo is used as part of validation
    // which occurs before guarantees of schema and document validity.
    switch (node.kind) {
      case Kind.DIRECTIVE:
        this._directive = schema.getDirective(node.name.value);
        break;
      case Kind.ARGUMENT: {
        let argDef;
        let argType: unknown;
        const fieldOrDirective = this.getDirective() ?? this.getFieldDef();
        if (fieldOrDirective) {
          argDef = fieldOrDirective.args.find(
            (arg) => arg.name === node.name.value,
          );
          if (argDef) {
            argType = argDef.type;
          }
        }
        this._argument = argDef;
        this._defaultValueStack.push(argDef ? argDef.defaultValue : undefined);
        this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
        break;
      }
      case Kind.LIST: {
        const listType = getNullableType(this.getInputType());
        const itemType = isListType(listType) ? listType.ofType : listType;
        // List positions never have a default value.
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const type: unknown = getNamedType(this.getInputType());
        if (isDataType(type) && type.isVariantType()) {
          const fieldType = type.variantBy().fields?.[node.name.value]?.type;
          this._inputTypeStack.push(
            isInputType(fieldType) ? fieldType : undefined,
          );
        }
        break;
      }
      case Kind.ENUM: {
        const enumType = getNamedType(this.getInputType());
        if (isDataType(enumType)) {
          this._enumValue = enumType.variantBy(node.value);
        }
        break;
      }
      default:
      // Ignore other nodes
    }
  }

  leave(node: ASTNode) {
    switch (node.kind) {
      case Kind.DIRECTIVE:
        this._directive = null;
        break;
      case Kind.ARGUMENT:
        this._argument = null;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.ENUM:
        this._enumValue = null;
        break;
      default:
      // Ignore other nodes
    }
  }
}

/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: ASTVisitor,
): ASTVisitor {
  return {
    enter(...args) {
      const node = args[0];
      typeInfo.enter(node);
      const fn = getEnterLeaveForKind(visitor, node.kind).enter;
      if (fn) {
        const result = fn.apply(visitor, args);
        if (result !== undefined) {
          typeInfo.leave(node);
          if (isNode(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(...args) {
      const node = args[0];
      const fn = getEnterLeaveForKind(visitor, node.kind).leave;
      let result;
      if (fn) {
        result = fn.apply(visitor, args);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}
