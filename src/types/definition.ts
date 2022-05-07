import type { GraphQLScalarType } from 'graphql';
import { specifiedScalarTypes } from 'graphql';
import { pluck } from 'ramda';

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

import type {
  ArgumentDefinitionNode,
  FieldDefinitionNode,
  Role,
  TypeDefinitionNode,
  VariantDefinitionNode,
  WrapperKind,
} from './ast';
import { isTypeVariantNode } from './ast';

export const stdScalars = keyMap(specifiedScalarTypes, ({ name }) => name);

export const scalarNames = Object.keys(stdScalars);

export const isSpecifiedScalarType = (type: IrisTypeDefinition): boolean =>
  Boolean(stdScalars[type.name]);

export type IrisType<R extends Role = Role> =
  | IrisTypeDefinition<R>
  | IrisTypeRef<R>;

export const isType = (type: unknown): type is IrisType =>
  instanceOf(type, IrisTypeDefinition) || isTypeRef(type);

type Printable = {
  toString: () => string;
  toJSON: () => string;
};

export class IrisTypeRefImp<K extends WrapperKind, T extends Printable> {
  readonly ofType: T;
  readonly kind: K;

  constructor(kind: K, ofType: T) {
    this.kind = kind;
    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'IrisTypeRef';
  }

  toString(): string {
    const type = this.ofType.toString();
    switch (this.kind) {
      case 'LIST':
        return '[' + type + ']';
      case 'MAYBE':
        return type + '?';
      default:
        return type;
    }
  }

  toJSON(): string {
    return this.toString();
  }
}

export type IrisTypeRef<R extends Role> =
  | IrisTypeRefImp<'LIST', IrisTypeRef<R>>
  | IrisTypeRefImp<'MAYBE', IrisTypeRef<R>>
  | IrisTypeRefImp<'NAMED', IrisTypeDefinition<R>>;

export const isTypeRef = <R extends Role>(
  type: unknown,
): type is IrisTypeRef<R> => instanceOf(type, IrisTypeRefImp);

export const isMaybeType = (type: unknown): type is IrisTypeRef<Role> =>
  isTypeRef(type) && type.kind === 'MAYBE';

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

export type IrisField<R extends Role = Role> = IrisNode & {
  astNode?: FieldDefinitionNode<R>;
  type: R extends 'data' ? IrisType<'data'> : IrisType;
  args?: R extends 'data' ? never : ReadonlyArray<IrisArgument>;
};

export type IrisVariant<R extends Role = Role> = IrisNode & {
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
  isVariantType: boolean;

  #thunkVariants: () => ReadonlyArray<IrisVariant<R>>;
  #resolvedVariants?: ReadonlyArray<IrisVariant<R>>;
  #scalar?: GraphQLScalarType;

  constructor(config: Readonly<IrisTypeConfig<R>>) {
    this.name = config.name;
    this.description = config.description;
    this.astNode = config.astNode;
    this.role = config.role;
    this.#thunkVariants = () => resolveThunk(config.variants);
    this.#scalar = config.scalar;
    this.isVariantType = config.astNode
      ? isTypeVariantNode(config.astNode)
      : false;
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
