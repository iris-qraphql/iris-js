import type { GraphQLFieldResolver } from 'graphql';
import { assertName, Kind, valueFromASTUntyped } from 'graphql';
import { contains, identity, pluck } from 'ramda';

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

export const unfoldConfigMap =
  <T>(f: (k: string, v: ConfigMapValue<T>) => T) =>
  (config: ConfigMap<T>): ReadonlyArray<T> =>
    Object.entries(config).map(([name, value]) => f(assertName(name), value));

// Predicates & Assertions

export type GraphQLType = IrisNamedType | IrisTypeRef<GraphQLType>;
export type GraphQLInputType = IrisDataType | IrisTypeRef<GraphQLInputType>;
export type GraphQLOutputType = GraphQLType;

export const isInputType = (type: unknown): type is GraphQLInputType =>
  isDataType(type) || (isTypeRef(type) && isInputType(type.ofType));

export const isType = (type: unknown): type is GraphQLType =>
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
      throw new Error(
        `Expected ${inspect(type)} to be a GraphQL ${kind} type.`,
      );
    }
    return type;
  };

export const assertResolverType = assertBy('Resolver', isResolverType);
export const assertDataType = assertBy('Data', isDataType);

export class IrisTypeRef<T extends GraphQLType> {
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

export const isTypeRef = <T extends GraphQLType>(
  type: unknown,
): type is IrisTypeRef<T> => instanceOf(type, IrisTypeRef);

export const isNonNullType = (
  type: unknown,
): type is IrisTypeRef<IrisNamedType> => !isMaybeType(type);

export const isMaybeType = (
  type: unknown,
): type is IrisTypeRef<IrisNamedType> =>
  isTypeRef(type) && type.kind === 'MAYBE';

export const isListType = (type: unknown): type is IrisTypeRef<GraphQLType> =>
  isTypeRef(type) && type.kind === 'LIST';

export const getNullableType = (
  type: Maybe<GraphQLType>,
): GraphQLType | undefined => {
  if (type) {
    return isTypeRef(type) && type.kind === 'MAYBE' ? type.ofType : type;
  }
};

export function getNamedType(type: undefined | null): void;
export function getNamedType(type: GraphQLInputType): IrisDataType;
export function getNamedType(type: GraphQLType): IrisNamedType;
export function getNamedType(
  type: Maybe<GraphQLType>,
): IrisNamedType | undefined;
export function getNamedType(
  type: Maybe<GraphQLType>,
): IrisNamedType | undefined {
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

export type IrisVariant<R extends Role> = IrisEntity & {
  astNode?: _VariantDefinitionNode<R>;

  toJSON?: () => string;
};

export type IrisDataVariant = IrisVariant<'data'> & {
  fields?: ObjMap<IrisDataVariantField>;
};

export type IrisDataVariantConfig = Override<
  IrisDataVariant,
  { fields?: Thunk<ConfigMap<IrisDataVariantField>> }
>;

export type IrisResolverVariant = IrisVariant<'resolver'> & {
  fields?: ObjMap<GraphQLField>;
  type?: IrisResolverType;
};

export type IrisResolverVariantConfig<S = any, C = any> = IrisEntity & {
  fields?: ThunkObjMap<GraphQLFieldConfig<S, C>>;
  type?: () => IrisResolverType;
  astNode?: _VariantDefinitionNode<'resolver'>;
};

export type IrisResolverTypeConfig<TSource, TContext> = {
  name: string;
  description?: Maybe<string>;
  variants: ReadonlyArray<IrisResolverVariantConfig<TSource, TContext>>;
  astNode?: Maybe<ResolverTypeDefinitionNode>;
};

// Type

export type IrisType<T> = {
  isVariantType: () => boolean;
  variants: () => ReadonlyArray<T>;
  // variantBy: (name?: string) => T;
};

const defineResolverField = <TSource, TContext>(
  fieldConfig: GraphQLFieldConfig<TSource, TContext>,
  fieldName: string,
): GraphQLField<TSource, TContext> => ({
  name: assertName(fieldName),
  description: fieldConfig.description,
  type: fieldConfig.type,
  args: defineArguments(fieldConfig.args ?? {}),
  resolve: fieldConfig.resolve,
  subscribe: fieldConfig.subscribe,
  deprecationReason: fieldConfig.deprecationReason,
  astNode: fieldConfig.astNode,
});

const defineResolverVariant = ({
  name,
  description,
  deprecationReason,
  fields,
  astNode,
  type,
}: IrisResolverVariantConfig): IrisResolverVariant => ({
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

export class IrisResolverType<TSource = any, TContext = any>
  implements IrisType<IrisResolverVariant>
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

  variants(): ReadonlyArray<IrisResolverVariant> {
    return this.#variants.map(defineResolverVariant);
  }

  variantBy(): IrisResolverVariant {
    return defineResolverVariant(this.#variants[0]);
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

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

const resolveVariant = ({
  name,
  description,
  deprecationReason,
  fields,
  astNode,
}: IrisDataVariantConfig): IrisDataVariant => ({
  name,
  description,
  deprecationReason,
  fields: fields ? mapValue(resolveThunk(fields), resolveField) : undefined,
  astNode,
  toJSON: () => name,
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
  astNode: Maybe<DataTypeDefinitionNode>;
  isPrimitive: boolean;

  #serialize: DataSerializer<O>;
  #parseValue: DataParser<I>;
  #parseLiteral: DataLiteralParser<I>;
  #variants: ReadonlyArray<IrisDataVariantConfig>;

  constructor(config: IrisDataTypeConfig<I, O>) {
    this.astNode = config.astNode;
    this.name = assertName(config.name);
    this.description = config.description;
    this.#variants = config.variants ?? [];
    this.isPrimitive =
      Boolean(config.isPrimitive) ||
      contains(this.#variants[0]?.name, PRIMITIVES);

    const parseValue = config.parseValue ?? (identity as DataParser<I>);
    this.#serialize = config.serialize ?? (identity as DataParser<O>);
    this.#parseValue = parseValue;
    this.#parseLiteral =
      config.parseLiteral ??
      ((node, variables) => parseValue(valueFromASTUntyped(node, variables)));
  }

  get [Symbol.toStringTag]() {
    return 'IrisDataType';
  }

  toString(): string {
    return this.name;
  }

  toJSON(): string {
    return this.toString();
  }

  isVariantType = () => {
    const [variant, ...xs] = this.#variants;
    return variant?.name === this.name && xs.length === 0;
  };

  variants(): ReadonlyArray<IrisDataVariant> {
    return this.#variants.map(resolveVariant);
  }

  variantBy(name?: string): IrisDataVariant {
    return resolveVariant(lookupVariant(this.name, this.#variants, name));
  }

  serialize(value: unknown): Maybe<any> {
    if (this.isPrimitive) {
      return this.#serialize(value);
    }

    return this.variantBy(assertString(this.name, value))?.name;
  }

  parseValue(value: unknown): Maybe<any> /* T */ {
    if (this.isPrimitive) {
      return this.#parseValue(value);
    }

    return this.variantBy(assertString(this.name, value))?.name;
  }

  parseLiteral(valueNode: ValueNode): Maybe<any> /* T */ {
    if (this.isPrimitive) {
      return this.#parseLiteral(valueNode);
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
