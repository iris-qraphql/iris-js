import type { GraphQLScalarType } from 'graphql';
import { assertName, specifiedScalarTypes } from 'graphql';
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
import { keyMap, mapValue } from '../utils/ObjMap';
import type { Maybe } from '../utils/type-level';

export const stdScalars = keyMap(specifiedScalarTypes, ({ name }) => name);

export const scalarNames = Object.keys(stdScalars);

export const isSpecifiedScalarType = (type: IrisTypeDefinition): boolean =>
  Boolean(stdScalars[type.name]);

export type IrisType<R extends Role = Role> =
  | IrisTypeDefinition<R>
  | IrisTypeRef<IrisType<R>>;

export const isInputType = (type: unknown): type is IrisType<'data'> =>
  (isTypeDefinition(type) && type.role === 'data') ||
  (isTypeRef(type) && isInputType(type.ofType));

export const isType = (type: unknown): type is IrisType =>
  isTypeDefinition(type) || isTypeRef(type);

const isTypeDefinition = (type: unknown): type is IrisTypeDefinition =>
  instanceOf(type, IrisTypeDefinition);

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
): type is IrisTypeRef<IrisTypeDefinition> =>
  isTypeRef(type) && type.kind === 'MAYBE';

export const unwrapType = (type: IrisType): IrisTypeDefinition =>
  isTypeRef(type) ? unwrapType(type.ofType) : type;

type IrisNode = {
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

export type IrisArgument = IrisNode & {
  type: IrisType<'data'>;
  defaultValue?: unknown;
  astNode?: ArgumentDefinitionNode;
};

export const isRequiredArgument = (arg: IrisArgument): boolean =>
  !isMaybeType(arg.type) && arg.defaultValue === undefined;

export type IrisField<R extends Role> = IrisNode & {
  astNode?: FieldDefinitionNode<R>;
  type: R extends 'data' ? IrisType<'data'> : IrisType;
  args?: R extends 'data' ? never : ReadonlyArray<IrisArgument>;
};

export type IrisVariant<R extends Role> = IrisNode & {
  astNode?: VariantDefinitionNode<R>;
  toJSON?: () => string;
  fields?: ObjMap<IrisField<R>>;
  type?: IrisTypeDefinition<R>;
};

type IrisTypeConfig<R extends Role> = {
  role: R;
  name: string;
  description?: Maybe<string>;
  variants: Thunk<ReadonlyArray<IrisVariant<R>>>;
  astNode?: Maybe<TypeDefinitionNode<R>>;
  scalar?: R extends 'data' ? GraphQLScalarType<any, any> : undefined;
};

export class IrisTypeDefinition<R extends Role = Role> {
  name: string;
  description: Maybe<string>;
  astNode: Maybe<TypeDefinitionNode<R>>;
  role: R;

  #thunkVariants: () => ReadonlyArray<IrisVariant<R>>;
  #resolvedVariants?: ReadonlyArray<IrisVariant<R>>;
  #scalar?: GraphQLScalarType;

  constructor(config: Readonly<IrisTypeConfig<R>>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.astNode = config.astNode;
    this.role = config.role;
    this.#thunkVariants = () => resolveThunk(config.variants);
    this.#scalar = config.scalar;
  }

  get [Symbol.toStringTag]() {
    return 'IrisTypeDefinition';
  }

  get boxedScalar() {
    if (this.#scalar) {
      return this.#scalar;
    }

    const [variant] = this.variants();
    return stdScalars[variant?.name];
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

  variants = (): ReadonlyArray<IrisVariant<R>> => {
    if (this.#resolvedVariants) {
      return this.#resolvedVariants;
    }
    this.#resolvedVariants = this.#thunkVariants();

    return this.#resolvedVariants;
  };

  variantBy = (name?: string): IrisVariant<R> =>
    lookupVariant(this.name, this.variants(), name);

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

export const IrisScalars = mapValue(
  stdScalars,
  (scalar) =>
    new IrisTypeDefinition({
      role: 'data',
      name: scalar.name,
      description: scalar.description,
      variants: [{ name: scalar.name }],
      scalar,
    }),
);
