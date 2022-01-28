import type { ResponsePath } from 'graphql';
import { Kind, valueFromASTUntyped } from 'graphql';
import { contains, identity, isNil, pluck } from 'ramda';

import { devAssert } from '../jsutils/devAssert';
import { inspect } from '../jsutils/inspect';
import { instanceOf } from '../jsutils/instanceOf';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import { mapValue } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { didYouMean, suggestionList } from '../jsutils/suggestions';

import type {
  ArgumentDefinitionNode,
  DataFieldDefinitionNode,
  DataTypeDefinitionNode,
  FieldDefinitionNode,
  ResolverTypeDefinitionNode,
  ValueNode,
  VariantDefinitionNode,
} from '../language/ast';
import { print } from '../language/printer';

import { GraphQLError } from '../error';
import type { ConfigMap, ConfigMapValue, Override } from '../utils/type-level';

import { assertName } from './assertName';
import type { GraphQLSchema } from './schema';

// UTILS

export const unfoldConfigMap =
  <T>(f: (k: string, v: ConfigMapValue<T>) => T) =>
  (config: ConfigMap<T>): ReadonlyArray<T> =>
    Object.entries(config).map(([name, value]) => f(assertName(name), value));

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
  return (
    isResolverType(type) ||
    isDataType(type) ||
    isListType(type) ||
    isNonNullType(type)
  );
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

export const isNullableType = (type: unknown): type is GraphQLNullableType =>
  isType(type) && !isNonNullType(type);

export const assertResolverType = assertBy('Resolver', isResolverType);
export const assertDataType = assertBy('Data', isDataType);
export const assertNonNullType = assertBy('Non-Null', isNonNullType);
export const assertListType = assertBy('List', isListType);

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

export type GraphQLNamedType = IrisResolverType | IrisDataType;

export function getNamedType(type: undefined | null): void;
export function getNamedType(type: GraphQLInputType): IrisDataType;
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

type IrisEntity = {
  name: string;
  description?: Maybe<string>;
  deprecationReason?: Maybe<string>;
};

export type ThunkObjMap<T> = Thunk<ObjMap<T>>;
export type Thunk<T> = (() => T) | T;

const isThunk = <T>(thunk: Thunk<T>): thunk is () => T =>
  typeof thunk === 'function';

const resolveThunk = <T>(thunk: Thunk<T>): T =>
  isThunk(thunk) ? thunk() : thunk;

export type DataSerializer<O> = (output: unknown) => O;
export type DataParser<I> = (input: unknown) => I;
export type DataLiteralParser<I> = (
  value: ValueNode,
  variables?: ObjMap<unknown>,
) => I;

// ARGUMENTS

export type GraphQLArgument = IrisEntity & {
  type: GraphQLInputType;
  defaultValue?: unknown;
  astNode?: Maybe<ArgumentDefinitionNode>;
};

export function isRequiredArgument(arg: GraphQLArgument): boolean {
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

export const defineArguments = unfoldConfigMap<GraphQLArgument>(
  (name, { description, type, defaultValue, deprecationReason, astNode }) => ({
    name,
    description,
    type,
    defaultValue,
    deprecationReason,
    astNode,
  }),
);

// FIELDS
const defineFieldFor =
  <TSource, TContext>(typename: string) =>
  (
    fieldConfig: GraphQLFieldConfig<TSource, TContext>,
    fieldName: string,
  ): GraphQLField<TSource, TContext> => {
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
  };

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

export type GraphQLResolveInfo = {
  readonly fieldName: string;
  readonly returnType: GraphQLOutputType;
  readonly parentType: IrisResolverType;
  readonly path: ResponsePath;
  readonly schema: GraphQLSchema;
  readonly rootValue: unknown;
  readonly variableValues: Record<string, unknown>;
};

export type GraphQLFieldConfig<TSource, TContext, TArgs = any> = {
  description?: Maybe<string>;
  deprecationReason?: Maybe<string>;
  type: GraphQLOutputType;
  args?: ConfigMap<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  astNode?: Maybe<FieldDefinitionNode>;
};

export type GraphQLField<
  TSource = unknown,
  TContext = unknown,
  TArgs = any,
> = IrisEntity & {
  type: GraphQLOutputType;
  args: ReadonlyArray<GraphQLArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  astNode: Maybe<FieldDefinitionNode>;
};

export type IrisDataVariantField = IrisEntity & {
  type: GraphQLInputType;
  astNode?: Maybe<DataFieldDefinitionNode>;
};

export type GraphQLFieldMap<TSource, TContext> = ObjMap<
  GraphQLField<TSource, TContext>
>;

export type IrisDataVariantConfig = Override<
  IrisDataVariant,
  { fields?: Thunk<ConfigMap<IrisDataVariantField>> }
>;

export type IrisResolverVariantConfig<TSource, TContext> = IrisEntity & {
  fields?: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>>;
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
      config.variants.length === 0 ||
      (config.variants.length === 1 &&
        config.variants[0]?.name === config.name &&
        config.variants[0]?.fields !== undefined);

    this.isTypeOf = config.isTypeOf;
    const configFields = config.variants[0]?.fields ?? {};

    this._fields = () =>
      this._isVariantType
        ? mapValue(resolveThunk(configFields), defineFieldFor(config.name))
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

  getResolverFields(): GraphQLFieldMap<TSource, TContext> {
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

export type IrisDataVariant = IrisEntity & {
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
  serialize?: DataSerializer<O>;
  /** Parses an externally provided value to use as an input. */
  parseValue?: DataParser<I>;
  /** Parses an externally provided literal value to use as an input. */
  parseLiteral?: DataLiteralParser<I>;
}>;

const dataVariant = (config: IrisDataVariantConfig): IrisDataVariantConfig => ({
  ...config,
  fields: config.fields
    ? () =>
        mapValue(
          resolveThunk(config.fields ?? {}),
          (fieldConfig, fieldName) => ({
            name: assertName(fieldName),
            description: fieldConfig.description,
            type: fieldConfig.type,
            deprecationReason: fieldConfig.deprecationReason,
            astNode: fieldConfig.astNode,
          }),
        )
    : undefined,
  toJSON: () => config.name,
});

const resolveVariant = (v: IrisDataVariantConfig): IrisDataVariant => ({
  ...v,
  fields: v?.fields
    ? mapValue(resolveThunk(v.fields), (x, name) => ({
        ...x,
        name,
      }))
    : undefined,
});

const PRIMITIVES = ['Int', 'Boolean', 'String', 'Float'];

const lookupVariant = <V extends { name: string }>(
  typeName: string,
  variants: ReadonlyArray<V>,
  name?: string,
): V => {
  if (!name) {
    if (variants.length !== 1) {
      throw new GraphQLError(
        `Object ${inspect(
          name,
        )} must provide variant name for type "${typeName}"`,
      );
    }
    return variants[0];
  }

  const variant = variants.find((x) => x.name === name);

  if (!variant) {
    throw new GraphQLError(
      `TODO: "${typeName}" cannot represent value: ${inspect(name)}`,
    );
  }

  return variant;
};

export class IrisDataType<I = unknown, O = I> {
  name: string;
  description: Maybe<string>;
  astNode: Maybe<DataTypeDefinitionNode>;
  isPrimitive: boolean;
  #serialize: DataSerializer<O>;
  #parseValue: DataParser<I>;
  #parseLiteral: DataLiteralParser<I>;
  private _variants: ReadonlyArray<IrisDataVariantConfig>;

  constructor(config: IrisDataTypeConfig<I, O>) {
    this.astNode = config.astNode;
    this.name = assertName(config.name);
    this.description = config.description;
    this._variants = (config.variants ?? []).map(dataVariant);
    this.isPrimitive =
      Boolean(config.isPrimitive) ||
      contains(this._variants[0]?.name, PRIMITIVES);

    const parseValue = config.parseValue ?? (identity as DataParser<I>);
    this.#serialize = config.serialize ?? (identity as DataParser<O>);
    this.#parseValue = parseValue;
    this.#parseLiteral =
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

  variantBy(name?: string): IrisDataVariant {
    return resolveVariant(lookupVariant(this.name, this._variants, name));
  }

  getFields(): ObjMap<IrisDataVariantField> {
    const fields = resolveVariant(this._variants[0])?.fields;
    return fields ?? {};
  }

  getValue(name: string): Maybe<IrisDataVariant> {
    const variant = this._variants.find((x) => x.name === name);
    return variant ? resolveVariant(variant) : undefined;
  }

  serialize(value: unknown): Maybe<any> {
    if (this.isPrimitive) {
      return this.#serialize(value);
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
      return this.#parseValue(inputValue);
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
      return this.#parseLiteral(valueNode);
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

const didYouMeanEnumValue = (enumType: IrisDataType, str: string): string =>
  didYouMean(
    'the enum value',
    suggestionList(str, pluck('name', enumType.getVariants())),
  );

export const isRequiredInputField = (field: IrisDataVariantField): boolean =>
  isNonNullType(field.type);
