import { uniqBy } from 'ramda';

import type { IrisError } from '../error';
import { inspect, instanceOf } from '../utils/legacy';
import type { ObjMap } from '../utils/ObjMap';
import type { Maybe } from '../utils/type-level';

import type { IrisNamedType, IrisResolverType, IrisType } from './definition';
import { getNamedType, isDataType, isResolverType } from './definition';
import type { GraphQLDirective } from './directives';
import { isDirective, specifiedDirectives } from './directives';

const notNill = <T>(x: Maybe<T>): x is T => Boolean(x);

/**
 * Test if the given value is a GraphQL schema.
 */
export function isSchema(schema: unknown): schema is IrisSchema {
  return instanceOf(schema, IrisSchema);
}

export function assertSchema(schema: unknown): IrisSchema {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }
  return schema;
}

export class IrisSchema {
  description: Maybe<string>;

  // Used as a cache for validateSchema().
  __validationErrors: Maybe<ReadonlyArray<IrisError>>;

  private _queryType: Maybe<IrisResolverType>;
  private _mutationType: Maybe<IrisResolverType>;
  private _subscriptionType: Maybe<IrisResolverType>;
  private _directives: ReadonlyArray<GraphQLDirective>;
  private _typeMap: TypeMap;

  constructor(config: Readonly<GraphQLSchemaConfig>) {
    this.__validationErrors = config.assumeValid === true ? [] : undefined;
    this._typeMap = {};
    this.description = config.description;
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription;
    this._directives = uniqBy(
      (x) => x.name,
      [...(config.directives ?? []), ...specifiedDirectives],
    );

    const types: Array<IrisNamedType> = [
      this._queryType,
      this._mutationType,
      this._subscriptionType,
      ...(config.types ?? []),
    ].filter(notNill);

    // To preserve order of user-provided types, we add first to add them to
    // the set of "collected" types, so `collectReferencedTypes` ignore them.
    const allReferencedTypes: Set<IrisNamedType> = new Set(config.types);

    types.forEach((type) => {
      allReferencedTypes.delete(type);
      collectReferencedTypes(type, allReferencedTypes);
    });

    collectDirectiveRefs(this._directives, allReferencedTypes);

    for (const namedType of allReferencedTypes) {
      if (namedType == null) {
        continue;
      }

      const typeName = namedType.name;
      if (!typeName) {
        throw new Error(
          'One of the provided types for building the Schema is missing a name.',
        );
      }

      if (this._typeMap[typeName] !== undefined) {
        throw new Error(
          `Iris Schema must contain uniquely named types but contains multiple types named "${typeName}".`,
        );
      }
      this._typeMap[typeName] = namedType;
    }
  }

  get [Symbol.toStringTag]() {
    return 'IrisSchema';
  }

  getQueryType = (): IrisResolverType | undefined =>
    this._queryType ?? undefined;

  getMutationType = (): IrisResolverType | undefined =>
    this._mutationType ?? undefined;

  getSubscriptionType = (): IrisResolverType | undefined =>
    this._subscriptionType ?? undefined;

  getTypeMap = (): TypeMap => this._typeMap;

  getType = (name: string): IrisNamedType | undefined =>
    this.getTypeMap()[name];

  getDirectives = (): ReadonlyArray<GraphQLDirective> => this._directives;

  getDirective = (name: string): Maybe<GraphQLDirective> =>
    this.getDirectives().find((directive) => directive.name === name);
}

type TypeMap = ObjMap<IrisNamedType>;

export type IrisSchemaValidationOptions = {
  assumeValid?: boolean;
  assumeValidSDL?: boolean;
};

export interface GraphQLSchemaConfig extends IrisSchemaValidationOptions {
  description?: Maybe<string>;
  query?: Maybe<IrisResolverType>;
  mutation?: Maybe<IrisResolverType>;
  subscription?: Maybe<IrisResolverType>;
  types?: Maybe<ReadonlyArray<IrisNamedType>>;
  directives?: Maybe<ReadonlyArray<GraphQLDirective>>;
}

const collectDirectiveRefs = (
  directives: ReadonlyArray<GraphQLDirective>,
  allReferencedTypes: Set<IrisNamedType>,
) => {
  for (const directive of directives) {
    // Directives are not validated until validateSchema() is called.
    if (isDirective(directive)) {
      directive.args.forEach((arg) =>
        collectReferencedTypes(arg.type, allReferencedTypes),
      );
    }
  }
};

function collectReferencedTypes(
  type: IrisType,
  typeSet: Set<IrisNamedType>,
): void {
  const namedType = getNamedType(type);

  if (typeSet.has(namedType)) {
    return;
  }

  typeSet.add(namedType);

  if (isResolverType(namedType)) {
    const variants = namedType.variants();
    if (namedType.isVariantType()) {
      const fields = Object.values(variants[0]?.fields ?? {});
      for (const field of fields) {
        collectReferencedTypes(field.type, typeSet);
        for (const arg of field.args) {
          collectReferencedTypes(arg.type, typeSet);
        }
      }
    } else {
      for (const variant of variants) {
        if (variant.type) {
          collectReferencedTypes(variant.type, typeSet);
        }
      }
    }
    return;
  }

  if (isDataType(namedType)) {
    namedType
      .variants()
      .flatMap((x) => Object.values(x.fields ?? {}))
      .forEach((field) => collectReferencedTypes(field.type, typeSet));
  }
}
