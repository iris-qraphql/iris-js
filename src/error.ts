import type { SourceLocation } from './parsing/location';
import { getLocation } from './parsing/location';
import type { Source } from './parsing/source';
import type { ASTNode, Location } from './types/ast';
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

    this.locations =
      nodePositions && source
        ? nodePositions.map((pos) => getLocation(source, pos))
        : nodeLocations?.map((loc) => getLocation(loc.source, loc.start));
  }

  override toString = (): string => JSON.stringify(this.toJSON());

  toJSON = (): JSONError =>
    omitNil({
      message: this.message,
      locations: this.locations,
      path: this.path,
    });
}
