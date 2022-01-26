import { locatedError as func } from 'graphql/error';
import type { Source } from 'graphql/language/source';

import type { Maybe } from './jsutils/Maybe';

import type { ASTNode } from './language/ast';

import { GraphQLError } from './gql-error/GraphQLError';

export {
  GraphQLError,
  printError,
  formatError,
} from './gql-error/GraphQLError';
export type {
  GraphQLFormattedError,
  GraphQLErrorExtensions,
} from './gql-error/GraphQLError';

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
