import { contains, identity, isNil, pluck } from 'ramda';

import { devAssert } from '../jsutils/devAssert';
import { didYouMean } from '../jsutils/didYouMean';
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
  ArgumentDefinitionNode,
  DataFieldDefinitionNode,
  DataTypeDefinitionNode,
  FieldDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  ResolverTypeDefinitionNode,
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
  | IrisResolverType
  | IrisDataType
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<IrisResolverType | IrisDataType | GraphQLList<GraphQLType>>;

export function isType(type: unknown): type is GraphQLType {
  return isNamedType(type) || isListType(type) || isNonNullType(type);
}

export function isNamedType(type: unknown): type is GraphQLNamedType {
  return isResolverType(type) || isDataType(type);
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

export const isDataType = (type: unknown): type is IrisDataType =>
  instanceOf(type, IrisDataType);

export function isEnumType(type: unknown): type is IrisDataType {
  return isDataType(type) && !type.isVariantType() && !type.isPrimitive;
}

export const isLeafType = isDataType;

export const isInputObjectType = (type: unknown): type is IrisDataType =>
  isDataType(type) && type.isVariantType();

export const isAbstractType = isUnionType;

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

export const isNullableType = (type: unknown): type is GraphQLNullableType =>
  isType(type) && !isNonNullType(type);

export const assertCompositeType = assertBy('Resolver', isResolverType);
export const assertResolverType = assertBy('Resolver', isResolverType);
export const assertObjectType = assertBy('Object', isObjectType);
export const assertDataType = assertBy('Data', isDataType);
export const assertLeafType = assertBy('leaf', isLeafType);
export const assertNonNullType = assertBy('Non-Null', isNonNullType);
export const assertListType = assertBy('List', isListType);
export const assertAbstractType = assertBy('abstract', isAbstractType);

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

export type GraphQLInputType =
  | IrisDataType
  | GraphQLList<GraphQLInputType>
  | GraphQLNonNull<IrisDataType | GraphQLList<GraphQLInputType>>;

export function isInputType(type: unknown): type is GraphQLInputType {
  return isDataType(type) || (isWrappingType(type) && isInputType(type.ofType));
}

export type GraphQLOutputType =
  | IrisResolverType
  | IrisDataType
  | GraphQLList<GraphQLOutputType>
  | GraphQLNonNull<
      IrisResolverType | IrisDataType | GraphQLList<GraphQLOutputType>
    >;

export function isOutputType(type: unknown): type is GraphQLOutputType {
  return (
    isResolverType(type) ||
    isDataType(type) ||
    (isWrappingType(type) && isOutputType(type.ofType))
  );
}

export type GraphQLLeafType = IrisDataType;

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

export type GraphQLWrappingType =
  | GraphQLList<GraphQLType>
  | GraphQLNonNull<GraphQLType>;

export function isWrappingType(type: unknown): type is GraphQLWrappingType {
  return isListType(type) || isNonNullType(type);
}

/**
 * These types can all accept null as a value.
 */
export type GraphQLNullableType =
  | IrisResolverType
  | IrisDataType
  | GraphQLList<GraphQLType>;

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

export type GraphQLNamedInputType = IrisDataType;

export type GraphQLNamedOutputType = IrisResolverType | IrisDataType;

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

export type GraphQLScalarSerializer<O> = (outputValue: unknown) => O;
export type GraphQLScalarValueParser<I> = (inputValue: unknown) => I;

export type GraphQLScalarLiteralParser<TInternal> = (
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
) => TInternal;

const defineFieldMap = <TSource, TContext>(
  typename: string,
  fields: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>,
): GraphQLFieldMap<TSource, TContext> =>
  mapValue(resolveThunk(fields), (fieldConfig, fieldName) => {
    devAssert(
      isPlainObj(fieldConfig),
      `${typename}.${fieldName} field config must be an object.`,
    );
    devAssert(
      fieldConfig.resolve == null || typeof fieldConfig.resolve === 'function',
      `${typename}.${fieldName} field resolver must be a function if ` +
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

const isPlainObj = (obj: unknown): boolean =>
  isObjectLike(obj) && !Array.isArray(obj);

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
  astNode?: Maybe<ArgumentDefinitionNode>;
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

export type GraphQLArgument = {
  name: string;
  description: Maybe<string>;
  type: GraphQLInputType;
  defaultValue: unknown;
  deprecationReason: Maybe<string>;
  astNode: Maybe<ArgumentDefinitionNode>;
};

export function isRequiredArgument(arg: GraphQLArgument): boolean {
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

export type IrisResolverVariantConfig<TSource, TContext> = {
  name?: string;
  description?: Maybe<string>;
  // inline variant
  fields?: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
  // variant ref
  type?: () => IrisResolverType;
};

export type IrisResolverTypeConfig<TSource, TContext> = {
  name: string;
  description?: Maybe<string>;
  resolveType?: Maybe<GraphQLTypeResolver<TSource, TContext>>;
  variants: ReadonlyArray<IrisResolverVariantConfig<TSource, TContext>>;
  astNode?: Maybe<ResolverTypeDefinitionNode>;
  // move to variant type
  isTypeOf?: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;
};

export class IrisResolverType<TSource = any, TContext = any> {
  name: string;
  description: Maybe<string>;
  resolveType: Maybe<GraphQLTypeResolver<any, any>>;
  astNode: Maybe<ResolverTypeDefinitionNode>;
  isTypeOf: Maybe<GraphQLIsTypeOfFn<TSource, TContext>>;

  private _types: () => ReadonlyArray<IrisResolverType>;
  private _fields: ThunkObjMap<GraphQLField<TSource, TContext>>;
  private _isVariantType: boolean;

  constructor(config: Readonly<IrisResolverTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.astNode = config.astNode;
    this._isVariantType =
      config.variants.length < 2 &&
      config.variants[0]?.name === config.name &&
      config.variants[0]?.fields !== undefined;

    this.isTypeOf = config.isTypeOf;
    this._fields = () =>
      this._isVariantType
        ? defineFieldMap(config.name, config.variants[0].fields ?? {})
        : {};

    // UNION
    this._types = () =>
      resolveThunk(config.variants ?? []).flatMap((x) =>
        x.type ? [x.type()] : [],
      );
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
    return this._types();
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

export type GraphQLInputField = IrisDataVariantField & {
  defaultValue?: unknown;
};

export type IrisDataVariantField = {
  name: string;
  description?: Maybe<string>;
  type: GraphQLInputType;
  deprecationReason?: Maybe<string>;
  astNode?: Maybe<DataFieldDefinitionNode>;
};

export type IrisDataVariant = {
  name: string;
  description?: Maybe<string>;
  deprecationReason?: Maybe<string>;
  astNode?: VariantDefinitionNode;
  fields?: ObjMap<IrisDataVariantField>;
  toJSON?: () => string;
};

type IrisDataTypeConfig<I, O> = Readonly<{
  name: string;
  description?: Maybe<string>;
  astNode?: Maybe<DataTypeDefinitionNode>;
  variants?: ReadonlyArray<IrisDataVariantConfig>;
  isPrimitive?: boolean;
  /** Serializes an internal value to include in a response. */
  serialize?: GraphQLScalarSerializer<O>;
  /** Parses an externally provided value to use as an input. */
  parseValue?: GraphQLScalarValueParser<I>;
  /** Parses an externally provided literal value to use as an input. */
  parseLiteral?: GraphQLScalarLiteralParser<I>;
}>;

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
  fields: mapValue(resolveThunk(v?.fields ?? {}), (x, name) => ({
    ...x,
    name,
  })),
});

export type GraphQLScalarType<I = unknown, O = I> = IrisDataType<I, O>;

const PRIMITIVES = ['Int', 'Boolean', 'String', 'Float'];

export class IrisDataType<I = unknown, O = I> {
  name: string;
  description: Maybe<string>;
  astNode: Maybe<DataTypeDefinitionNode>;
  isPrimitive: boolean;
  private _serialize: GraphQLScalarSerializer<O>;
  private _parseValue: GraphQLScalarValueParser<I>;
  private _parseLiteral: GraphQLScalarLiteralParser<I>;
  private _variants: ReadonlyArray<IrisDataVariantConfig>;

  constructor(config: IrisDataTypeConfig<I, O>) {
    this.astNode = config.astNode;
    this.name = assertName(config.name);
    this.description = config.description;
    this._variants = (config.variants ?? []).map(dataVariant);
    this.isPrimitive =
      Boolean(config.isPrimitive) ||
      contains(this._variants[0]?.name, PRIMITIVES);

    const parseValue =
      config.parseValue ?? (identity as GraphQLScalarValueParser<I>);
    this._serialize =
      config.serialize ?? (identity as GraphQLScalarValueParser<O>);
    this._parseValue = parseValue;
    this._parseLiteral =
      config.parseLiteral ??
      ((node, variables) => parseValue(valueFromASTUntyped(node, variables)));

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
    if (this.isPrimitive) {
      return this._serialize(value);
    }

    const enumValue = this.getValue((value as any)?.name ?? value);
    if (isNil(enumValue)) {
      throw new GraphQLError(
        `Data "${this.name}" cannot represent value: ${inspect(value)}`,
      );
    }

    return enumValue.name;
  }

  parseValue(inputValue: unknown): Maybe<any> /* T */ {
    if (this.isPrimitive) {
      return this._parseValue(inputValue);
    }

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

  parseLiteral(valueNode: ValueNode): Maybe<any> /* T */ {
    if (this.isPrimitive) {
      return this._parseLiteral(valueNode);
    }
    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind !== Kind.ENUM) {
      const valueStr = print(valueNode);
      throw new GraphQLError(
        `Data "${this.name}" cannot represent value: ${valueStr}.` +
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
