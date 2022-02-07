import type { GraphQLScalarType } from 'graphql';
import {
  assertName,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql';
import { pluck } from 'ramda';

import type {
  ArgumentDefinitionNode,
  FieldDefinitionNode,
  Role,
  TypeDefinitionNode,
  VariantDefinitionNode,
  WrapperKind,
} from '../language/ast';

import { irisError } from '../error';
import {
  didYouMean,
  inspect,
  instanceOf,
  suggestionList,
} from '../utils/legacy';
import type { ObjMap } from '../utils/ObjMap';
import { mapValue } from '../utils/ObjMap';
import type { ConfigMap, Maybe } from '../utils/type-level';

export const stdScalars: Record<string, GraphQLScalarType> = Object.freeze({
  String: GraphQLString,
  Int: GraphQLInt,
  Float: GraphQLFloat,
  Bool: GraphQLBoolean,
  ID: GraphQLID,
});

export const fromConfig = <T extends {}>(
  obj: Record<string, T>,
): Record<string, T & { name: string }> =>
  Object.fromEntries(
    Object.entries(obj).map(
      ([name, field]: [string, T]): [string, T & { name: string }] => [
        name,
        { ...field, name: assertName(name) },
      ],
    ),
  );

type TYPE_MAP = {
  data: IrisDataType;
  resolver: IrisResolverType;
};

export type IrisNamedType<R extends Role = Role> = TYPE_MAP[R];

export type IrisType<R extends Role = Role> =
  | IrisNamedType<R>
  | IrisTypeRef<IrisType<R>>;

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

export const isTypeRef = <T extends IrisType>(
  type: unknown,
): type is IrisTypeRef<T> => instanceOf(type, IrisTypeRef);

export const isMaybeType = (
  type: unknown,
): type is IrisTypeRef<IrisNamedType> =>
  isTypeRef(type) && type.kind === 'MAYBE';

export const isListType = (type: unknown): type is IrisTypeRef<IrisType> =>
  isTypeRef(type) && type.kind === 'LIST';

export const unpackMaybe = (type: Maybe<IrisType>): IrisType | undefined => {
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

export const resolveThunk = <T>(thunk: Thunk<T>): T =>
  isThunk(thunk) ? thunk() : thunk;

export type IrisArgument = IrisEntity & {
  type: IrisStrictType;
  defaultValue?: unknown;
  astNode?: Maybe<ArgumentDefinitionNode>;
};

export const isRequiredArgument = (arg: IrisArgument): boolean =>
  !isMaybeType(arg.type) && arg.defaultValue === undefined;

export type IrisField<R extends Role> = IrisEntity & {
  type: R extends 'data' ? IrisStrictType : IrisType;
  astNode?: FieldDefinitionNode<R>;
} & (R extends 'resolver'
    ? {
        args: ReadonlyArray<IrisArgument>;
      }
    : {});

export type IrisFieldConfig<R extends Role> = Omit<
  IrisField<R>,
  'args' | 'name'
> & {
  args?: R extends 'resolver' ? ConfigMap<IrisArgument> : never;
};

export type IrisVariant<R extends Role> = IrisEntity & {
  astNode?: VariantDefinitionNode<R>;
  toJSON?: () => string;
  fields?: ObjMap<IrisField<R>>;
  type?: IrisNamedType<R>;
};

export type IrisVariantConfig<R extends Role> = Omit<
  IrisVariant<R>,
  'fields'
> & {
  fields?: ObjMap<IrisFieldConfig<R>>;
  type?: IrisNamedType<R>;
};

export type IrisTypeConfig<R extends Role> = {
  name: string;
  description?: Maybe<string>;
  variants: Thunk<ReadonlyArray<IrisVariantConfig<R>>>;
  astNode?: Maybe<TypeDefinitionNode<R>>;
};

type IrisTypeDef<T> = {
  isVariantType: () => boolean;
  variants: () => ReadonlyArray<T>;
};

export const buildArguments = (
  args: ConfigMap<IrisArgument>,
): Array<IrisArgument> => Object.values(fromConfig(args));

const buildField = <R extends Role>(
  { description, args, type, deprecationReason, astNode }: IrisFieldConfig<R>,
  fieldName: string,
): IrisField<R> => ({
  name: assertName(fieldName),
  description,
  type,
  args: buildArguments(args ?? {}),
  deprecationReason,
  astNode,
});

const buildVariant = <R extends Role>({
  name,
  description,
  deprecationReason,
  fields,
  astNode,
  type,
}: IrisVariantConfig<R>): IrisVariant<R> => ({
  name,
  description,
  deprecationReason,
  fields: fields ? mapValue(fields, buildField) : undefined,
  type,
  astNode,
  toJSON: () => name,
});

export class IrisResolverType implements IrisTypeDef<IrisVariant<'resolver'>> {
  name: string;
  description: Maybe<string>;
  astNode: Maybe<TypeDefinitionNode<'resolver'>>;
  #thunkVariants: () => ReadonlyArray<IrisVariantConfig<'resolver'>>;
  #resolvedVariants?: ReadonlyArray<IrisVariant<'resolver'>>;

  constructor(config: Readonly<IrisTypeConfig<'resolver'>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.astNode = config.astNode;
    this.#thunkVariants = () => resolveThunk(config.variants);
  }

  get [Symbol.toStringTag]() {
    return 'IrisResolverType';
  }

  isVariantType = (): boolean => {
    const variants = this.variants();
    return (
      variants.length === 0 ||
      (variants.length === 1 &&
        variants[0]?.name === this.name &&
        variants[0]?.fields !== undefined)
    );
  };

  variants = (): ReadonlyArray<IrisVariant<'resolver'>> => {
    if (this.#resolvedVariants) {
      return this.#resolvedVariants;
    }
    this.#resolvedVariants = this.#thunkVariants().map(buildVariant);

    return this.#resolvedVariants;
  };

  variantBy = (): IrisVariant<'resolver'> => this.variants()[0];

  toString = (): string => this.name;

  toJSON = (): string => this.toString();
}

const lookupVariant = <V extends { name: string }>(
  typeName: string,
  variants: ReadonlyArray<V>,
  name?: string,
): V => {
  if (!name) {
    if (variants.length !== 1) {
      throw irisError(
        `Object ${inspect(
          name,
        )} must provide variant name for type "${typeName}"`,
      );
    }
    return variants[0];
  }

  const variant = variants.find((v) => v.name === name);

  if (!variant) {
    throw irisError(
      `Data "${typeName}" cannot represent value: ${inspect(name)}` +
        didYouMean(
          'the variant',
          suggestionList(name, pluck('name', variants)),
        ),
    );
  }

  return variant;
};

export class IrisDataType<I = unknown, O = I> {
  name: string;
  description: Maybe<string>;
  #scalar?: GraphQLScalarType;
  #thunkVariants: () => ReadonlyArray<IrisVariantConfig<'data'>>;
  #resolvedVariants?: ReadonlyArray<IrisVariant<'data'>>;
  astNode: Maybe<TypeDefinitionNode<'data'>>;

  constructor(
    config: IrisTypeConfig<'data'> & {
      scalar?: GraphQLScalarType<I, O>;
    },
  ) {
    this.astNode = config.astNode;
    this.name = assertName(config.name);
    this.description = config.description;
    this.#thunkVariants = () => resolveThunk(config.variants) ?? [];
    this.#scalar = config.scalar;
  }

  get [Symbol.toStringTag]() {
    return 'IrisDataType';
  }

  get boxedScalar() {
    if (this.#scalar) {
      return this.#scalar;
    }

    const [variant] = this.variants();
    return stdScalars[variant?.name];
  }

  toString = (): string => this.name;

  toJSON = (): string => this.toString();

  isVariantType = () =>
    this.variants()[0]?.name === this.name && this.variants().length === 1;

  variants = (): ReadonlyArray<IrisVariant<'data'>> => {
    if (this.#resolvedVariants) {
      return this.#resolvedVariants;
    }

    this.#resolvedVariants = this.#thunkVariants().map((x) => buildVariant(x));
    return this.#resolvedVariants;
  };

  variantBy = (name?: string): IrisVariant<'data'> =>
    buildVariant(lookupVariant(this.name, this.variants(), name));
}
