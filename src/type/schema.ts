import { uniqBy } from 'ramda';

import type { IrisError } from '../error';
import { inspect, instanceOf } from '../utils/legacy';
import type { ObjMap } from '../utils/ObjMap';
import type { Maybe } from '../utils/type-level';
import { notNill } from '../utils/type-level';

import { collectAllReferencedTypes } from './collectAllReferencedTypes';
import type { IrisNamedType, IrisTypeDefinition } from './definition';
import type { GraphQLDirective } from './directives';
import { specifiedDirectives } from './directives';

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

  private _queryType: Maybe<IrisTypeDefinition<'resolver'>>;
  private _mutationType: Maybe<IrisTypeDefinition<'resolver'>>;
  private _subscriptionType: Maybe<IrisTypeDefinition<'resolver'>>;
  private _directives: ReadonlyArray<GraphQLDirective>;
  private _typeMap: TypeMap;

  constructor(config: Readonly<IrisSchemaConfig>) {
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

    collectAllReferencedTypes(types, this._directives).forEach((namedType) => {
      const { name } = namedType;

      if (!name) {
        throw new Error(
          'One of the provided types for building the Schema is missing a name.',
        );
      }

      if (this._typeMap[name] !== undefined) {
        throw new Error(
          `Iris Schema must contain uniquely named types but contains multiple types named "${name}".`,
        );
      }

      this._typeMap[name] = namedType;
    });
  }

  get [Symbol.toStringTag]() {
    return 'IrisSchema';
  }

  getQueryType = (): IrisTypeDefinition<'resolver'> | undefined =>
    this._queryType ?? undefined;

  getMutationType = (): IrisTypeDefinition<'resolver'> | undefined =>
    this._mutationType ?? undefined;

  getSubscriptionType = (): IrisTypeDefinition<'resolver'> | undefined =>
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

export interface IrisSchemaConfig extends IrisSchemaValidationOptions {
  description?: Maybe<string>;
  query?: Maybe<IrisTypeDefinition<'resolver'>>;
  mutation?: Maybe<IrisTypeDefinition<'resolver'>>;
  subscription?: Maybe<IrisTypeDefinition<'resolver'>>;
  types?: Maybe<ReadonlyArray<IrisNamedType>>;
  directives?: Maybe<ReadonlyArray<GraphQLDirective>>;
}
