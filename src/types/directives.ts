import { assertName } from 'graphql';

import { inspect, instanceOf } from '../utils/legacy';
import type { Maybe } from '../utils/type-level';

import type { ArgumentDefinitionNode, DirectiveDefinitionNode } from './ast';
import { IrisDirectiveLocation } from './directiveLocation';

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
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
export class GraphQLDirective {
  name: string;
  description: Maybe<string>;
  locations: ReadonlyArray<IrisDirectiveLocation>;
  // args: ReadonlyArray<IrisArgument>;
  isRepeatable: boolean;
  astNode: Maybe<DirectiveDefinitionNode>;

  constructor(config: Readonly<GraphQLDirectiveConfig>) {
    this.name = assertName(config.name);
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = config.isRepeatable ?? false;
    this.astNode = config.astNode;
    // this.args = Object.values(config.args ?? {});
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
  locations: ReadonlyArray<IrisDirectiveLocation>;
  args?: ReadonlyArray<ArgumentDefinitionNode>;
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
      IrisDirectiveLocation.FIELD_DEFINITION,
      IrisDirectiveLocation.ARGUMENT_DEFINITION,
    ],
    // args: [
    //   {
    //     name: 'reason',
    //     type: { },
    //     description: 'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
    //     defaultValue: '',
    //   },
    // ],
  });

/**
 * The full list of specified directives.
 */
export const specifiedDirectives: ReadonlyArray<GraphQLDirective> =
  Object.freeze([GraphQLDeprecatedDirective]);

export function isSpecifiedDirective(directive: GraphQLDirective): boolean {
  return specifiedDirectives.some(({ name }) => name === directive.name);
}
