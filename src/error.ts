/* eslint-disable @typescript-eslint/no-useless-constructor */
import type { Source } from 'graphql';
import { GraphQLError as GQLError } from 'graphql';
import { locatedError as func } from 'graphql/error';
import type {
  GraphQLErrorArgs,
  GraphQLErrorExtensions,
} from 'graphql/error/GraphQLError';

import type { Maybe } from './jsutils/Maybe';

import type { ASTNode } from './language/ast';

type IrisErrorArgs = GraphQLErrorArgs & {
  node: ReadonlyArray<ASTNode> | ASTNode | null;
};

export class GraphQLError extends GQLError {
  constructor(
    message: string,
    nodes?: ReadonlyArray<ASTNode> | ASTNode | null,
    source?: Maybe<Source>,
    positions?: Maybe<ReadonlyArray<number>>,
    path?: Maybe<ReadonlyArray<string | number>>,
    originalError?: Maybe<
      Error & {
        readonly extensions?: unknown;
      }
    >,
    extensions?: Maybe<GraphQLErrorExtensions>,
  ) {
    // @ts-expect-error
    super(message, nodes, source, positions, path, originalError, extensions);
  }

  // @ts-expect-error
  constructor(message: string, args?: IrisErrorArgs);
}

export const locatedError = (
  rawOriginalError: unknown,
  nodes: ASTNode | ReadonlyArray<ASTNode> | undefined | null,
  path?: Maybe<ReadonlyArray<string | number>>,
): GraphQLError =>
  // @ts-expect-error
  func(rawOriginalError, nodes, path);

export function syntaxError(
  source: Source,
  position: number,
  description: string,
): GraphQLError {
  return new GraphQLError(`Syntax Error: ${description}`, undefined, source, [
    position,
  ]);
}
