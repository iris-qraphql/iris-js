import { isNil, pluck } from 'ramda';

import { devAssert } from '../jsutils/devAssert';
import { didYouMean } from '../jsutils/didYouMean';
import { identityFunc } from '../jsutils/identityFunc';
import { inspect } from '../jsutils/inspect';
import { instanceOf } from '../jsutils/instanceOf';
import { isObjectLike } from '../jsutils/isObjectLike';
import { mapValue } from '../jsutils/mapValue';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Path } from '../jsutils/Path';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { suggestionList } from '../jsutils/suggestionList';

import { GraphQLError } from '../error/GraphQLError';

import type {
  DataTypeDefinitionNode,
  FieldDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  InputValueDefinitionNode,
  OperationDefinitionNode,
  ResolverTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  ValueNode,
  VariantDefinitionNode,
} from '../language/ast';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

import { valueFromASTUntyped } from '../utilities/valueFromASTUntyped';

import type { Override } from '../utils/type-level';

import { assertName } from './assertName';
import type { GraphQLSchema } from './schema';

// Predicates & Assertions

/**
 * These are all of the possible kinds of types.
 */
export type GraphQLType =
  | GraphQLScalarType
  | IrisResolverType
  | IrisDataType
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | IrisResolverType
      | IrisDataType
      | GraphQLList<GraphQLType>
    >;

export function isType(type: unknown): type is GraphQLType {
  return (
    isScalarType(type) ||
    isResolverType(type) ||
    isDataType(type) ||
    isListType(type) ||
    isNonNullType(type)
  );
}


export function isScalarType(type: unknown): type is GraphQLScalarType {
  return instanceOf(type, GraphQLScalarType);
}

export function isResolverType(type: unknown): type is IrisResolverType {
  return instanceOf(type, IrisResolverType);
}
export function isObjectType(type: unknown): type is IrisResolverType {
  return isResolverType(type) && type.isVariantType();
}

export function isUnionType(type: unknown): type is IrisResolverType {
  return isResolverType(type) && !type.isVariantType();
}

export function isDataType(type: unknown): type is IrisDataType {
  return instanceOf(type, IrisDataType);
}

export function isEnumType(type: unknown): type is IrisDataType {
  return isDataType(type) && !type.isVariantType();
}

export const isInputObjectType = (type: unknown): type is IrisDataType =>
  isDataType(type) && type.isVariantType();

export const assertBy =
  <T>(kind: string, f: (type: unknown) => type is T) =>
  (type: unknown): T => {
    if (!f(type)) {
      throw new Error(
        `Expected ${inspect(type)} to be a GraphQL ${kind} type.`,
      );
    }
    return type;
  };

export const assertCompositeType = assertBy('Resolver', isResolverType);
export const assertResolverType = assertBy('Resolver', isResolverType);
export const assertObjectType = assertBy('Object', isObjectType);
export const assertDataType = assertBy('Data', isDataType);
export const assertScalarType = assertBy('Scalar', isScalarType);
export const assertType = assertBy('', isType);

export function isListType(
  type: GraphQLInputType,
): type is GraphQLList<GraphQLInputType>;
export function isListType(
  type: GraphQLOutputType,
): type is GraphQLList<GraphQLOutputType>;
export function isListType(type: unknown): type is GraphQLList<GraphQLType>;
export function isListType(type: unknown): type is GraphQLList<GraphQLType> {
  return instanceOf(type, GraphQLList);
}

export function assertListType(type: unknown): GraphQLList<GraphQLType> {
  if (!isListType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
  }
  return type;
}

export function isNonNullType(
  type: GraphQLInputType,
): type is GraphQLNonNull<GraphQLInputType>;
export function isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLOutputType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType>;
export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLType> {
  return instanceOf(type, GraphQLNonNull);
}

export function assertNonNullType(type: unknown): GraphQLNonNull<GraphQLType> {
  if (!isNonNullType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
  }
  return type;
}

export type GraphQLInputType =
  | GraphQLScalarType
  | IrisDataType
  | GraphQLList<GraphQLInputType>
  | GraphQLNonNull<
      GraphQLScalarType | IrisDataType | GraphQLList<GraphQLInputType>
    >;

export function isInputType(type: unknown): type is GraphQLInputType {
  return (
    isScalarType(type) ||
    isDataType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

export type GraphQLOutputType =
  | GraphQLScalarType
  | IrisResolverType
  | IrisDataType
  | GraphQLList<GraphQLOutputType>
  | GraphQLNonNull<
      | GraphQLScalarType
      | IrisResolverType
      | IrisDataType
      | GraphQLList<GraphQLOutputType>
    >;

export function isOutputType(type: unknown): type is GraphQLOutputType {
  return (
    isScalarType(type) ||
    isResolverType(type) ||
    isEnumType(type) ||
    (isWrappingType(type) && isOutputType(type.ofType))
  );
}

export type GraphQLLeafType = GraphQLScalarType | IrisDataType;

export function isLeafType(type: unknown): type is GraphQLLeafType {
  return isScalarType(type) || isEnumType(type);
}

export function assertLeafType(type: unknown): GraphQLLeafType {
  if (!isLeafType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL leaf type.`);
  }
  return type;
}

/**
 * These types may describe the parent context of a selection set.
 */
export type GraphQLCompositeType = IrisResolverType;

export function isCompositeType(type: unknown): type is GraphQLCompositeType {
  return isResolverType(type);
}

export const isAbstractType = (type: unknown): type is IrisResolverType =>
  isUnionType(type);

export function assertAbstractType(type: unknown): IrisResolverType {
  if (!isAbstractType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL abstract type.`);
  }
  return type;
}

export class GraphQLList<T extends GraphQLType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL type.`,
    );

    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLList';
  }

  toString(): string {
    return '[' + String(this.ofType) + ']';
  }

  toJSON(): string {
    return this.toString();
  }
}

export class GraphQLNonNull<T extends GraphQLNullableType> {
  readonly ofType: T;

  constructor(ofType: T) {
    devAssert(
      isNullableType(ofType),
      `Expected ${inspect(ofType)} to be a GraphQL nullable type.`,
    );

    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLNonNull';
  }

  toString(): string {
    return String(this.ofType) + '!';
  }

  toJSON(): string {
    return this.toString();
  }
}

/**
 * These types wrap and modify other types
 */

export type GraphQLWrappingType =
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<GraphQLType>;

export function isWrappingType(type: unknown): type is GraphQLWrappingType {
  return isListType(type) || isNonNullType(type);
}

export function assertWrappingType(type: unknown): GraphQLWrappingType {
  if (!isWrappingType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL wrapping type.`);
  }
  return type;
}

/**
 * These types can all accept null as a value.
 */
export type GraphQLNullableType =
  | GraphQLScalarType
  | IrisResolverType
  | IrisDataType
  | GraphQLList<GraphQLType>;

export function isNullableType(type: unknown): type is GraphQLNullableType {
  return isType(type) && !isNonNullType(type);
}

export function assertNullableType(type: unknown): GraphQLNullableType {
  if (!isNullableType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
  }
  return type;
}

export function getNullableType(type: undefined | null): void;
export function getNullableType<T extends GraphQLNullableType>(
  type: T | GraphQLNonNull<T>,
): T;
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined;
export function getNullableType(
  type: Maybe<GraphQLType>,
): GraphQLNullableType | undefined {
  if (type) {
    return isNonNullType(type) ? type.ofType : type;
  }
}

/**
 * These named types do not include modifiers like List or NonNull.
 */
export type GraphQLNamedType = GraphQLNamedInputType | GraphQLNamedOutputType;

export type GraphQLNamedInputType = GraphQLScalarType | IrisDataType;

export type GraphQLNamedOutputType =
  | GraphQLScalarType
  | IrisResolverType
  | IrisDataType;

export function isNamedType(type: unknown): type is GraphQLNamedType {
  return isScalarType(type) || isResolverType(type) || isDataType(type);
}

export function assertNamedType(type: unknown): GraphQLNamedType {
  if (!isNamedType(type)) {
    throw new Error(`Expected ${inspect(type)} to be a GraphQL named type.`);
  }
  return type;
}

export function getNamedType(type: undefined | null): void;
export function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
export function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
export function getNamedType(type: GraphQLType): GraphQLNamedType;
export function getNamedType(
  type: Maybe<GraphQLType>,
): GraphQLNamedType | undefined;
export function getNamedType(
  type: Maybe<GraphQLType>,
): GraphQLNamedType | undefined {
  if (type) {
    let unwrappedType = type;
    while (isWrappingType(unwrappedType)) {
      unwrappedType = unwrappedType.ofType;
    }
    return unwrappedType;
  }
}

/**
 * Used while defining GraphQL types to allow for circular references in
 * otherwise immutable type definitions.
 */
export type ThunkReadonlyArray<T> = Thunk<ReadonlyArray<T>>;
export type ThunkObjMap<T> = Thunk<ObjMap<T>>;
export type Thunk<T> = (() => T) | T;

const isThunk = <T>(thunk: Thunk<T>): thunk is () => T =>
  typeof thunk === 'function';

const resolveThunk = <T>(thunk: Thunk<T>): T =>
  isThunk(thunk) ? thunk() : thunk;

export class GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
  name: string;
  description: Maybe<string>;
  specifiedByURL: Maybe<string>;
  serialize: GraphQLScalarSerializer<TExternal>;
  parseValue: GraphQLScalarValueParser<TInternal>;
  parseLiteral: GraphQLScalarLiteralParser<TInternal>;
  astNode: Maybe<ScalarTypeDefinitionNode>;

  constructor(config: Readonly<GraphQLScalarTypeConfig<TInternal, TExternal>>) {
    const parseValue =
      config.parseValue ??
      (identityFunc as GraphQLScalarValueParser<TInternal>);

    this.name = assertName(config.name);
    this.description = config.description;
    this.specifiedByURL = config.specifiedByURL;
    this.serialize =
      config.serialize ?? (identityFunc as GraphQLScalarSerializer<TExternal>);
    this.parseValue = parseValue;
    this.parseLiteral =
      config.parseLiteral ??
      ((node, variables) => parseValue(valueFromASTUntyped(node, variables)));
    this.astNode = config.astNode;

    devAssert(
      config.specifiedByURL == null ||
        typeof config.specifiedByURL === 'string',
      `${this.name} must provide "specifiedByURL" as a string, ` +
        `but got: ${inspect(config.specifiedByURL)}.`,
    );

    devAssert(
      config.serialize == null || typeof config.serialize === 'function',
      `${this.name} must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.`,
    );

    if (config.parseLiteral) {
      devAssert(
        typeof config.parseValue === 'function' &&
          typeof config.parseLiteral === 'function',
        `${this.name} must provide both "parseValue" and "parseLiteral" functions.`,
      );
    }
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLScalarType';
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

export type GraphQLScalarSerializer<TExternal> = (
  outputValue: unknown,
) => TExternal;

export type GraphQLScalarValueParser<TInternal> = (
  inputValue: unknown,
) => TInternal;

export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
) => TInternal;

export interface GraphQLScalarTypeConfig<TInternal, TExternal> {
  name: string;
  description?: Maybe<string>;
  specifiedByURL?: Maybe<string>;
  /** Serializes an internal value to include in a response. */
  serialize?: GraphQLScalarSerializer<TExternal>;
  /** Parses an externally provided value to use as an input. */
  parseValue?: GraphQLScalarValueParser<TInternal>;
  /** Parses an externally provided literal value to use as an input. */
  parseLiteral?: GraphQLScalarLiteralParser<TInternal>;
  astNode?: Maybe<ScalarTypeDefinitionNode>;
}

function defineFieldMap<TSource, TContext>(
  config: Readonly<IrisResolverTypeConfig<TSource, TContext>>,
): GraphQLFieldMap<TSource, TContext> {
  const fieldMap = resolveThunk(config.fields);
  devAssert(
    isPlainObj(fieldMap),
    `${config.name} fields must be an object with field names as keys or a function which returns such an object.`,
  );

  // @ts-expect-error
  return mapValue(fieldMap, (fieldConfig, fieldName) => {
    devAssert(
      isPlainObj(fieldConfig),
      `${config.name}.${fieldName} field config must be an object.`,
    );
    devAssert(
      fieldConfig.resolve == null || typeof fieldConfig.resolve === 'function',
      `${config.name}.${fieldName} field resolver must be a function if ` +
        `provided, but got: ${inspect(fieldConfig.resolve)}.`,
    );

    return {
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      args: defineArguments(fieldConfig.args ?? {}),
      resolve: fieldConfig.resolve,
      subscribe: fieldConfig.subscribe,
      deprecationReason: fieldConfig.deprecationReason,
      astNode: fieldConfig.astNode,
    };
  });
}

export const defineArguments = (
  config: GraphQLFieldConfigArgumentMap,
): ReadonlyArray<GraphQLArgument> =>
  Object.entries(config).map(([argName, argConfig]) => ({
    name: assertName(argName),
    description: argConfig.description,
    type: argConfig.type,
    defaultValue: argConfig.defaultValue,
    deprecationReason: argConfig.deprecationReason,
    astNode: argConfig.astNode,
  }));

function isPlainObj(obj: unknown): boolean {
  return isObjectLike(obj) && !Array.isArray(obj);
}

export type GraphQLTypeResolver<TSource, TContext> = (
  value: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
  abstractType: IrisResolverType,
) => PromiseOrValue<string | undefined>;

export type GraphQLIsTypeOfFn<TSource, TContext> = (
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo,
) => PromiseOrValue<boolean>;

export type GraphQLFieldResolver<
  TSource,
  TContext,
  TArgs = any,
  TResult = unknown,
> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult;

export interface GraphQLResolveInfo {
  readonly fieldName: string;
  readonly fieldNodes: ReadonlyArray<FieldNode>;
  readonly returnType: GraphQLOutputType;
  readonly parentType: IrisResolverType;
  readonly path: Path;
  readonly schema: GraphQLSchema;
  readonly fragments: ObjMap<FragmentDefinitionNode>;
  readonly rootValue: unknown;
  readonly operation: OperationDefinitionNode;
  readonly variableValues: Record<string, unknown>;
}

export interface GraphQLFieldConfig<TSource, TContext, TArgs = any> {
  description?: Maybe<string>;
  type: GraphQLOutputType;
  args?: GraphQLFieldConfigArgumentMap;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason?: Maybe<string>;
  astNode?: Maybe<FieldDefinitionNode>;
}

export type GraphQLFieldConfigArgumentMap = ObjMap<GraphQLArgumentConfig>;

export interface GraphQLArgumentConfig {
  description?: Maybe<string>;
  type: GraphQLInputType;
  defaultValue?: unknown;
  deprecationReason?: Maybe<string>;
  astNode?: Maybe<InputValueDefinitionNode>;
}

export type GraphQLFieldConfigMap<TSource, TContext> = ObjMap<
  GraphQLFieldConfig<TSource, TContext>
>;

export interface GraphQLField<TSource, TContext, TArgs = any> {
  name: string;
  description: Maybe<string>;
  type: GraphQLOutputType;
  args: ReadonlyArray<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  deprecationReason: Maybe<string>;
  astNode: Maybe<FieldDefinitionNode>;
}

export interface GraphQLArgument {
  name: string;
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: Maybe<string>;
  astNode: Maybe<InputValueDefinitionNode>;
}

export function isRequiredArgument(arg: GraphQLArgument): boolean {
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

export type IrisResolverTypeConfig<TSource, TContext> = {
  name: string;
  description?: Maybe<string>;
  // union
  types?: ThunkReadonlyArray<IrisResolverType>;
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  astNode?: Maybe<ResolverTypeDefinitionNode>;
  // object
  fields?: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
};

export class IrisResolverType<TSource = any, TContext = any> {
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  astNode: Maybe<ResolverTypeDefinitionNode>;
  isTypeOf: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;

  private _types: ThunkReadonlyArray<IrisResolverType>;
  private _fields: ThunkObjMap<GraphQLField<TSource, TContext>>;
  private _isVariantType: boolean;

  constructor(config: Readonly<IrisResolverTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.astNode = config.astNode;
    this._isVariantType = config.fields !== undefined;
    // OBJECT
    this.isTypeOf = config.isTypeOf;
    this._fields = () => defineFieldMap(config ?? {});

    // UNION
    this._types = () => resolveThunk(config.types ?? []);
    this.resolveType = config.resolveType;

    devAssert(
      config.isTypeOf == null || typeof config.isTypeOf === 'function',
      `${this.name} must provide "isTypeOf" as a function, ` +
        `but got: ${inspect(config.isTypeOf)}.`,
    );

    devAssert(
      config.resolveType == null || typeof config.resolveType === 'function',
      `${this.name} must provide "resolveType" as a function, ` +
        `but got: ${inspect(config.resolveType)}.`,
    );
  }

  get [Symbol.toStringTag]() {
    return 'IrisResolverType';
  }

  isVariantType = (): boolean => this._isVariantType;

  getFields(): GraphQLFieldMap<TSource, TContext> {
    if (typeof this._fields === 'function') {
      this._fields = this._fields();
    }
    return this._fields;
  }

  getTypes(): ReadonlyArray<IrisResolverType> {
    if (typeof this._types === 'function') {
      this._types = this._types();
    }
    return this._types;
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

export type GraphQLInputField = {
  name: string;
  description?: Maybe<string>;
  type: GraphQLInputType;
  defaultValue?: unknown;
  deprecationReason?: Maybe<string>;
  astNode?: Maybe<InputValueDefinitionNode>;
};

export type IrisDataVariantField = {
  name: string;
  description?: Maybe<string>;
  type: GraphQLInputType;
  deprecationReason?: Maybe<string>;
  astNode?: Maybe<InputValueDefinitionNode>;
};

export type IrisDataVariant = {
  name: string;
  description?: Maybe<string>;
  deprecationReason?: Maybe<string>;
  astNode?: VariantDefinitionNode;
  fields?: ObjMap<IrisDataVariantField>;
  toJSON?: () => string;
};

type IrisDataTypeConfig = {
  name: string;
  description?: Maybe<string>;
  variants?: ReadonlyArray<IrisDataVariantConfig>;
  astNode?: Maybe<DataTypeDefinitionNode>;
};

type IrisDataVariantConfig = Override<
  IrisDataVariant,
  { fields?: ThunkObjMap<Omit<GraphQLInputField, 'name'>> }
>;

const dataVariant = (config: IrisDataVariantConfig): IrisDataVariantConfig => ({
  ...config,
  fields: () =>
    mapValue(resolveThunk(config.fields ?? {}), (fieldConfig, fieldName) => ({
      name: assertName(fieldName),
      description: fieldConfig.description,
      type: fieldConfig.type,
      defaultValue: fieldConfig.defaultValue,
      deprecationReason: fieldConfig.deprecationReason,
      astNode: fieldConfig.astNode,
    })),
  toJSON: () => config.name,
});

const resolveVariant = (v: IrisDataVariantConfig): IrisDataVariant => ({
  ...v,
  fields: mapValue(resolveThunk(v.fields ?? {}), (x, name) => ({ ...x, name })),
});

export class IrisDataType {
  name: string;
  description: Maybe<string>;
  astNode: Maybe<DataTypeDefinitionNode>;
  private _variants: ReadonlyArray<IrisDataVariantConfig>;

  constructor(config: Readonly<IrisDataTypeConfig>) {
    this.astNode = config.astNode;
    this.name = assertName(config.name);
    this.description = config.description;
    this._variants = (config.variants ?? []).map(dataVariant);
  }

  get [Symbol.toStringTag]() {
    return 'IrisDataType';
  }

  isVariantType = () => {
    const [variant, ...xs] = this._variants;
    return variant?.name === this.name && xs.length === 0;
  };

  getVariants(): ReadonlyArray<IrisDataVariant> {
    return this._variants.map(resolveVariant);
  }

  getFields(): ObjMap<GraphQLInputField> {
    const fields = resolveVariant(this._variants[0])?.fields;
    return fields ?? {};
  }

  getValue(name: string): Maybe<IrisDataVariant> {
    const variant = this._variants.find((x) => x.name === name);
    return variant ? resolveVariant(variant) : undefined;
  }

  serialize(value: unknown): Maybe<any> {
    const enumValue = this.getValue((value as any)?.name ?? value);
    if (isNil(enumValue)) {
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent value: ${inspect(value)}`,
      );
    }

    return enumValue.name;
  }

  parseValue(inputValue: unknown): Maybe<any> /* T */ {
    if (typeof inputValue !== 'string') {
      const valueStr = inspect(inputValue);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
      );
    }

    const enumValue = this.getValue(inputValue);
    if (enumValue == null) {
      throw new GraphQLError(
        `Value "${inputValue}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, inputValue),
      );
    }
    return enumValue.name;
  }

  parseLiteral(
    valueNode: ValueNode,
    _variables: Maybe<ObjMap<unknown>>,
  ): Maybe<any> /* T */ {
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
          didYouMeanEnumValue(this, valueStr),
        valueNode,
      );
    }

    const enumValue = this._variants.find((x) => x.name === valueNode.value);
    if (enumValue == null) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Value "${valueStr}" does not exist in "${this.name}" enum.` +
          didYouMeanEnumValue(this, valueStr),
        valueNode,
      );
    }

    return enumValue;
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

function didYouMeanEnumValue(
  enumType: IrisDataType,
  unknownValueStr: string,
): string {
  const suggestedValues = suggestionList(
    unknownValueStr,
    pluck('name', enumType.getVariants()),
  );
  return didYouMean('the enum value', suggestedValues);
}

export function isRequiredInputField(field: GraphQLInputField): boolean {
  return isNonNullType(field.type) && field.defaultValue === undefined;
}
