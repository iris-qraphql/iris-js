import type { ASTNode as Node, Source } from 'graphql';
import { GraphQLError } from 'graphql';
import type { GraphQLErrorArgs } from 'graphql/error/GraphQLError';

import type { ASTNode } from './language/ast';

export type IrisError = GraphQLError;

type ErrorNode = ReadonlyArray<ASTNode> | ASTNode | null;

type IrisErrorArgs = GraphQLErrorArgs & {
  node?: ErrorNode;
};

export const irisError = (message: string, args?: IrisErrorArgs) =>
  new GraphQLError(message, args);

export const irisNodeError = (message: string, node?: ErrorNode) =>
  new GraphQLError(message, node as Node);

export const isIrisError = (err: unknown): err is IrisError =>
  err instanceof GraphQLError;

export const syntaxError = (
  source: Source,
  position: number,
  description: string,
): IrisError =>
  irisError(`Syntax Error: ${description}`, {
    source,
    positions: [position],
  });
