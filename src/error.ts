import type { ASTNode as GQLASTNode, Source } from 'graphql';
import { GraphQLError as GQLError } from 'graphql';
import type {
  GraphQLErrorArgs,
  GraphQLErrorExtensions,
} from 'graphql/error/GraphQLError';

import type { ASTNode } from './language/ast';

import type { Maybe } from './utils/type-level';

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
    super(
      message,
      nodes as GQLASTNode,
      source,
      positions,
      path,
      originalError,
      extensions,
    );
  }

  // @ts-expect-error
  constructor(message: string, args?: IrisErrorArgs);
}

export function syntaxError(
  source: Source,
  position: number,
  description: string,
): GraphQLError {
  return new GraphQLError(`Syntax Error: ${description}`, undefined, source, [
    position,
  ]);
}
