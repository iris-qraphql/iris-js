import type { Source } from 'graphql';
import { GraphQLError } from 'graphql';
import type { GraphQLErrorArgs } from 'graphql/error/GraphQLError';

import type { ASTNode } from './types/ast';

export type IrisError = GraphQLError;

type ErrorNode = ReadonlyArray<ASTNode> | ASTNode;

type IrisErrorArgs = Omit<GraphQLErrorArgs, 'nodes'> & {
  nodes?: ErrorNode;
};

export const irisError = (message: string, args?: IrisErrorArgs) =>
  new GraphQLError(message, args as GraphQLErrorArgs);

export const syntaxError = (
  source: Source,
  position: number,
  description: string,
): IrisError =>
  irisError(`Syntax Error: ${description}`, {
    source,
    positions: [position],
  });
