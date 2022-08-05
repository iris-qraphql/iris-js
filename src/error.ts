import type { Location, Source, SourceLocation } from 'graphql';
import { getLocation, printLocation, printSourceLocation } from 'graphql';

import type { ASTNode } from './types/ast';
import { omitNil } from './utils/type-level';

type ErrorNode = ReadonlyArray<ASTNode> | ASTNode;

type JSONError = {
  message: string;
  locations?: ReadonlyArray<SourceLocation>;
  path?: ReadonlyArray<string | number>;
};

type IrisErrorArgs = {
  nodes?: ErrorNode;
  source?: Source;
  positions?: ReadonlyArray<number>;
  path?: ReadonlyArray<string | number>;
};

export const irisError = (message: string, args?: IrisErrorArgs) =>
  new IrisError(message, args);

export const syntaxError = (
  source: Source,
  position: number,
  description: string,
): IrisError =>
  irisError(`Syntax Error: ${description}`, {
    source,
    positions: [position],
  });

export class IrisError extends Error {
  readonly locations: ReadonlyArray<SourceLocation> | undefined;
  readonly path: ReadonlyArray<string | number> | undefined;
  readonly nodes: ReadonlyArray<ASTNode> | undefined;
  readonly source: Source | undefined;

  constructor(
    message: string,
    { nodes, source, positions, path }: IrisErrorArgs = {},
  ) {
    super(message);

    this.path = path ?? undefined;
    this.nodes = nodes ? [nodes].flat() : undefined;
    const nodeLocations = this.nodes
      ?.map((node) => node.loc)
      .filter((loc): loc is Location => loc != null);
    const nodePositions = positions ?? nodeLocations?.map((loc) => loc.start);

    this.source = source ?? nodeLocations?.[0]?.source;
    
    this.locations =
      nodePositions && source
        ? nodePositions.map((pos) => getLocation(source, pos))
        : nodeLocations?.map((loc) => getLocation(loc.source, loc.start));
  }

  override toString(): string {
    let output = this.message;

    if (this.nodes) {
      for (const node of this.nodes) {
        if (node.loc) {
          output += '\n\n' + printLocation(node.loc);
        }
      }
    } else if (this.source && this.locations) {
      for (const location of this.locations) {
        output += '\n\n' + printSourceLocation(this.source, location);
      }
    }

    return output;
  }

  toJSON = (): JSONError =>
    omitNil({
      message: this.message,
      locations: this.locations,
      path: this.path,
    });
}
