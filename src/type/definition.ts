import type { GraphQLFieldResolver, GraphQLScalarType } from 'graphql';
import {
  assertName,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  Kind,
} from 'graphql';
import { pluck } from 'ramda';

import { inspect } from '../jsutils/inspect';
import { instanceOf } from '../jsutils/instanceOf';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import { mapValue } from '../jsutils/ObjMap';
import { didYouMean, suggestionList } from '../jsutils/suggestions';

import type {
  _VariantDefinitionNode,
  ArgumentDefinitionNode,
  DataFieldDefinitionNode,
  DataTypeDefinitionNode,
  FieldDefinitionNode,
  ResolverTypeDefinitionNode,
  Role,
  ValueNode,
  WrapperKind,
} from '../language/ast';
import { print } from '../language/printer';

import { GraphQLError } from '../error';
import type { ConfigMap, ConfigMapValue, Override } from '../utils/type-level';

export const stdScalars: Record<string, GraphQLScalarType> = Object.freeze({
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Bool: GraphQLBoolean,
  ID: GraphQLID,
});

export const unfoldConfigMap =
  <T>(f: (k: string, v: ConfigMapValue<T>) => T) =>
  (config: ConfigMap<T>): ReadonlyArray<T> =>
    Object.entries(config).map(([name, value]) => f(assertName(name), value));

// Predicates & Assertions

export type IrisType = IrisNamedType | IrisTypeRef<IrisType>;
export type IrisStrictType = IrisDataType | IrisTypeRef<IrisStrictType>;

export const isInputType = (type: unknown): type is IrisStrictType =>
  isDataType(type) || (isTypeRef(type) && isInputType(type.ofType));

export const isType = (type: unknown): type is IrisType =>
  isResolverType(type) || isDataType(type) || isTypeRef(type);

export const isResolverType = (type: unknown): type is IrisResolverType =>
  instanceOf(type, IrisResolverType);

export const isObjectType = (type: unknown): type is IrisResolverType =>
  isResolverType(type) && type.isVariantType();

export const isDataType = (type: unknown): type is IrisDataType =>
  instanceOf(type, IrisDataType);

export const assertBy =
  <T>(kind: string, f: (type: unknown) => type is T) =>
  (type: unknown): T => {
    if (!f(type)) {
      throw new Error(`Expected ${inspect(type)} to be a Iris ${kind} type.`);
    }
    return type;
  };

export const assertResolverType = assertBy('Resolver', isResolverType);
export const assertDataType = assertBy('Data', isDataType);

export class IrisTypeRef<T extends IrisType> {
  readonly ofType: T;
  readonly kind: WrapperKind;

  constructor(kind: WrapperKind, ofType: T) {
    this.kind = kind;
    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'IrisTypeRef';
  }

  toString(): string {
    const name = this.ofType.toString();
    switch (this.kind) {
      case 'LIST':
        return '[' + name + ']';
      case 'MAYBE':
        return name + '?';
      default:
        return name;
    }
  }

  toJSON(): string {
    return this.toString();
  }
}
export type IrisNamedType = IrisResolverType | IrisDataType;

export const isTypeRef = <T extends IrisType>(
  type: unknown,
): type is IrisTypeRef<T> => instanceOf(type, IrisTypeRef);

export const isNonNullType = (
  type: unknown,
): type is IrisTypeRef<IrisNamedType> => !isMaybeType(type);

export const isMaybeType = (
  type: unknown,
): type is IrisTypeRef<IrisNamedType> =>
  isTypeRef(type) && type.kind === 'MAYBE';

export const isListType = (type: unknown): type is IrisTypeRef<IrisType> =>
  isTypeRef(type) && type.kind === 'LIST';

export const getNullableType = (
  type: Maybe<IrisType>,
): IrisType | undefined => {
  if (type) {
    return isTypeRef(type) && type.kind === 'MAYBE' ? type.ofType : type;
  }
};

export function getNamedType(type: undefined | null): void;
export function getNamedType(type: IrisStrictType): IrisDataType;
export function getNamedType(type: IrisType): IrisNamedType;
export function getNamedType(type: Maybe<IrisType>): IrisNamedType | undefined;
export function getNamedType(type: Maybe<IrisType>): IrisNamedType | undefined {
  if (type) {
    let unwrappedType = type;
    while (isTypeRef(unwrappedType)) {
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

export type IrisArgument = IrisEntity & {
  type: IrisStrictType;
  defaultValue?: unknown;
  astNode?: Maybe<ArgumentDefinitionNode>;
};

export function isRequiredArgument(arg: IrisArgument): boolean {
  return isNonNullType(arg.type) && arg.defaultValue === undefined;
}

export const defineArguments = unfoldConfigMap<IrisArgument>(
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

export type IrisFieldConfig<TSource, TContext, TArgs = any> = {
  description?: Maybe<string>;
  deprecationReason?: Maybe<string>;
  type: IrisType;
  args?: ConfigMap<IrisArgument>;
  resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  subscribe?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  astNode?: FieldDefinitionNode;
};

export type IrisVariantField<R extends Role> = IrisEntity & {
  type: R extends 'data' ? IrisStrictType : IrisType;
  astNode?: R extends 'data' ? DataFieldDefinitionNode : FieldDefinitionNode;
} & (R extends 'resolver'
    ? {
        args: ReadonlyArray<IrisArgument>;
        resolve?: GraphQLFieldResolver<any, any>;
        subscribe?: GraphQLFieldResolver<any, any>;
      }
    : {});

export type IrisDataVariantField = IrisVariantField<'data'>;
export type IrisResolverVariantField = IrisVariantField<'resolver'>;

export type IrisVariant<R extends Role> = IrisEntity & {
  astNode?: _VariantDefinitionNode<R>;
  toJSON?: () => string;
  fields?: ObjMap<IrisVariantField<R>>;
  type?: R extends 'resolver' ? IrisResolverType : never;
};

export type IrisDataVariantConfig = Override<
  IrisVariant<'data'>,
  { fields?: Thunk<ConfigMap<IrisDataVariantField>> }
>;

export type IrisResolverVariantConfig<S = any, C = any> = IrisEntity & {
  fields?: ThunkObjMap<IrisFieldConfig<S, C>>;
  type?: () => IrisResolverType;
  astNode?: _VariantDefinitionNode<'resolver'>;
};

export type IrisResolverTypeConfig<TSource, TContext> = {
  name: string;
  description?: Maybe<string>;
  variants: ReadonlyArray<IrisResolverVariantConfig<TSource, TContext>>;
  astNode?: Maybe<ResolverTypeDefinitionNode>;
};

type IrisTypeDef<T> = {
  isVariantType: () => boolean;
  variants: () => ReadonlyArray<T>;
};

const defineResolverField = <TSource, TContext>(
  fieldConfig: IrisFieldConfig<TSource, TContext>,
  fieldName: string,
): IrisResolverVariantField => ({
  name: assertName(fieldName),
  description: fieldConfig.description,
  type: fieldConfig.type,
  args: defineArguments(fieldConfig.args ?? {}),
  resolve: fieldConfig.resolve,
  subscribe: fieldConfig.subscribe,
  deprecationReason: fieldConfig.deprecationReason,
  astNode: fieldConfig.astNode,
});

const buildResolverVariant = ({
  name,
  description,
  deprecationReason,
  fields,
  astNode,
  type,
}: IrisResolverVariantConfig): IrisVariant<'resolver'> => ({
  name,
  description,
  deprecationReason,
  fields: fields
    ? mapValue(resolveThunk(fields), defineResolverField)
    : undefined,
  type: type?.(),
  astNode,
  toJSON: () => name,
});

const buildDataVariant = ({
  name,
  description,
  deprecationReason,
  fields,
  astNode,
}: IrisDataVariantConfig): IrisVariant<'data'> => ({
  name,
  description,
  deprecationReason,
  fields: fields ? mapValue(resolveThunk(fields), resolveField) : undefined,
  astNode,
  toJSON: () => name,
});

export class IrisResolverType<TSource = any, TContext = any>
  implements IrisTypeDef<IrisVariant<'resolver'>>
{
  name: string;
  description: Maybe<string>;
  astNode: Maybe<ResolverTypeDefinitionNode>;
  #variants: ReadonlyArray<IrisResolverVariantConfig<TSource, TContext>>;
  #isVariantType: boolean;

  constructor(config: Readonly<IrisResolverTypeConfig<any, any>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.astNode = config.astNode;
    this.#isVariantType =
      config.variants.length === 0 ||
      (config.variants.length === 1 &&
        config.variants[0]?.name === config.name &&
        config.variants[0]?.fields !== undefined);
    this.#variants = config.variants;
  }

  get [Symbol.toStringTag]() {
    return 'IrisResolverType';
  }

  isVariantType = (): boolean => this.#isVariantType;

  variants = (): ReadonlyArray<IrisVariant<'resolver'>> =>
    this.#variants.map(buildResolverVariant);

  variantBy = (): IrisVariant<'resolver'> =>
    buildResolverVariant(this.#variants[0]);

  toString = (): string => this.name;

  toJSON = (): string => this.toString();
}

type IrisDataTypeConfig<I, O> = Readonly<{
  name: string;
  description?: Maybe<string>;
  variants?: ReadonlyArray<IrisDataVariantConfig>;
  scalar?: GraphQLScalarType<I, O>;
  astNode?: Maybe<DataTypeDefinitionNode>;
}>;

const resolveField = (
  {
    description,
    type,
    deprecationReason,
    astNode,
  }: ConfigMapValue<IrisDataVariantField>,
  fieldName: string,
) => ({
  name: assertName(fieldName),
  description,
  type,
  deprecationReason,
  astNode,
});

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

  const variant = variants.find((v) => v.name === name);

  if (!variant) {
    throw new GraphQLError(
      `Data "${typeName}" cannot represent value: ${inspect(name)}` +
        didYouMean(
          'the variant',
          suggestionList(name, pluck('name', variants)),
        ),
    );
  }

  return variant;
};

const assertString = (type: string, value: unknown): string => {
  if (typeof value !== 'string') {
    const valueStr = inspect(value);
    throw new GraphQLError(
      `Data "${type}" cannot represent non-string value: ${valueStr}.`,
    );
  }
  return value;
};

export class IrisDataType<I = unknown, O = I> {
  name: string;
  description: Maybe<string>;
  #variants: ReadonlyArray<IrisDataVariantConfig>;
  #scalar?: GraphQLScalarType;
  astNode: Maybe<DataTypeDefinitionNode>;

  constructor(config: IrisDataTypeConfig<I, O>) {
    this.astNode = config.astNode;
    this.name = assertName(config.name);
    this.description = config.description;
    this.#variants = config.variants ?? [];
    this.#scalar = config.scalar ?? stdScalars[this.#variants[0]?.name];
  }

  get isPrimitive() {
    return Boolean(this.#scalar);
  }

  get [Symbol.toStringTag]() {
    return 'IrisDataType';
  }

  toString = (): string => this.name;

  toJSON = (): string => this.toString();

  isVariantType = () =>
    this.#variants[0]?.name === this.name && this.#variants.length === 1;

  variants = (): ReadonlyArray<IrisVariant<'data'>> =>
    this.#variants.map(buildDataVariant);

  variantBy = (name?: string): IrisVariant<'data'> =>
    buildDataVariant(lookupVariant(this.name, this.#variants, name));

  serialize = (value: unknown): Maybe<any> =>
    this.#scalar
      ? this.#scalar.serialize(value)
      : this.variantBy(assertString(this.name, value))?.name;

  parseValue = (value: unknown): Maybe<any> =>
    this.#scalar
      ? this.#scalar.parseValue(value)
      : this.variantBy(assertString(this.name, value))?.name;

  parseLiteral(valueNode: ValueNode): Maybe<any> {
    if (this.#scalar) {
      return this.#scalar.parseLiteral(valueNode);
    }

    // Note: variables will be resolved to a value before calling this function.
    if (valueNode.kind !== Kind.ENUM) {
      throw new GraphQLError(
        `Data "${this.name}" cannot represent value: ${print(valueNode)}.`,
        { node: valueNode },
      );
    }

    return this.#variants.find((x) => x.name === valueNode.value);
  }
}
