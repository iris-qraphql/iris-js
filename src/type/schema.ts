import { uniqBy } from 'ramda';

import type { IrisError } from '../error';
import { inspect, instanceOf } from '../utils/legacy';
import type { ObjMap } from '../utils/ObjMap';
import type { IrisMaybe, Maybe } from '../utils/type-level';
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

  readonly query?: IrisTypeDefinition<'resolver'>;
  readonly mutation?: IrisTypeDefinition<'resolver'>;
  readonly subscription?: IrisTypeDefinition<'resolver'>;
  readonly directives: ReadonlyArray<GraphQLDirective>;
  readonly typeMap: TypeMap;

  // Used as a cache for validateSchema().
  __validationErrors: Maybe<ReadonlyArray<IrisError>>;

  constructor(config: Readonly<IrisSchemaConfig>) {
    this.__validationErrors = config.assumeValid === true ? [] : undefined;
    this.description = config.description;
    this.query = config.query ?? undefined;
    this.mutation = config.mutation ?? undefined;
    this.subscription = config.subscription ?? undefined;
    this.directives = uniqBy(
      ({ name }) => name,
      [...(config.directives ?? []), ...specifiedDirectives],
    );

    const types: Array<IrisNamedType> = [
      this.query,
      this.mutation,
      this.subscription,
      ...(config.types ?? []),
    ].filter(notNill);

    const typeMap: TypeMap = {};

    collectAllReferencedTypes(types, this.directives).forEach((namedType) => {
      const { name } = namedType;

      if (!name) {
        throw new Error(
          'One of the provided types for building the Schema is missing a name.',
        );
      }

      if (typeMap[name] !== undefined) {
        throw new Error(
          `Iris Schema must contain uniquely named types but contains multiple types named "${name}".`,
        );
      }

      typeMap[name] = namedType;
    });

    this.typeMap = typeMap;
  }

  get [Symbol.toStringTag]() {
    return 'IrisSchema';
  }

  getType = (name: string): IrisMaybe<IrisNamedType> => this.typeMap[name];

  getDirective = (name: string): Maybe<GraphQLDirective> =>
    this.directives.find((directive) => directive.name === name);
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
