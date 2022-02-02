import { assertName } from 'graphql';

import type { Maybe } from '../jsutils/Maybe';

import type { DirectiveDefinitionNode } from '../language/ast';
import { DirectiveLocation } from '../language/directiveLocation';

import { inspect, instanceOf } from '../utils/legacy';
import type { ConfigMap } from '../utils/type-level';

import type { IrisArgument } from './definition';
import { buildArguments } from './definition';
import { IrisString } from './scalars';

/**
 * Test if the given value is a GraphQL directive.
 */
export function isDirective(directive: unknown): directive is GraphQLDirective {
  return instanceOf(directive, GraphQLDirective);
}

export function assertDirective(directive: unknown): GraphQLDirective {
  if (!isDirective(directive)) {
    throw new Error(
      `Expected ${inspect(directive)} to be a GraphQL directive.`,
    );
  }
  return directive;
}

/**
 * Custom extensions
 *
 * @remarks
 * Use a unique identifier name for your extension, for example the name of
 * your library or project. Do not use a shortened identifier as this increases
 * the risk of conflicts. We recommend you add at most one extension field,
 * an object which can contain all the values you need.
 */
export type GraphQLDirectiveExtensions = Record<string, unknown>;

/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective {
  name: string;
  description: Maybe<string>;
  locations: ReadonlyArray<DirectiveLocation>;
  args: ReadonlyArray<IrisArgument>;
  isRepeatable: boolean;
  astNode: Maybe<DirectiveDefinitionNode>;

  constructor(config: Readonly<GraphQLDirectiveConfig>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = config.isRepeatable ?? false;
    this.astNode = config.astNode;
    this.args = buildArguments(config.args ?? {});
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLDirective';
  }

  toString(): string {
    return '@' + this.name;
  }

  toJSON(): string {
    return this.toString();
  }
}

export interface GraphQLDirectiveConfig {
  name: string;
  description?: Maybe<string>;
  locations: ReadonlyArray<DirectiveLocation>;
  args?: ConfigMap<IrisArgument>;
  isRepeatable?: Maybe<boolean>;
  astNode?: Maybe<DirectiveDefinitionNode>;
}

/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
export const GraphQLDeprecatedDirective: GraphQLDirective =
  new GraphQLDirective({
    name: 'deprecated',
    description: 'Marks an element of a GraphQL schema as no longer supported.',
    locations: [
      DirectiveLocation.FIELD_DEFINITION,
      DirectiveLocation.ARGUMENT_DEFINITION,
      DirectiveLocation.INPUT_FIELD_DEFINITION,
      DirectiveLocation.ENUM_VALUE,
    ],
    args: {
      reason: {
        type: IrisString,
        description:
          'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
        defaultValue: '',
      },
    },
  });

/**
 * The full list of specified directives.
 */
export const specifiedDirectives: ReadonlyArray<GraphQLDirective> =
  Object.freeze([GraphQLDeprecatedDirective]);

export function isSpecifiedDirective(directive: GraphQLDirective): boolean {
  return specifiedDirectives.some(({ name }) => name === directive.name);
}
