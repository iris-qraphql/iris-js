interface Location {
  line: number;
  column: number;
}

/**
 * A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
 * optional, but they are useful for clients who store GraphQL documents in source files.
 * For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
 * be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
 * The `line` and `column` properties in `locationOffset` are 1-indexed.
 */
export class Source {
  body: string;
  name: string;
  locationOffset: Location;

  constructor(
    body: string,
    name: string = 'GraphQL request',
    locationOffset: Location = { line: 1, column: 1 },
  ) {
    this.body = body;
    this.name = name;
    this.locationOffset = locationOffset;
  }

  get [Symbol.toStringTag]() {
    return 'Source';
  }
}

const LineRegExp = /\r\n|[\n\r]/g;

/**
 * Represents a location in a Source.
 */
export interface SourceLocation {
  readonly line: number;
  readonly column: number;
}

/**
 * Takes a Source and a UTF-8 character offset, and returns the corresponding
 * line and column as a SourceLocation.
 */
export function getLocation(source: Source, position: number): SourceLocation {
  let lastLineStart = 0;
  let line = 1;

  for (const match of source.body.matchAll(LineRegExp)) {
    const i = match?.index ?? 0;

    if (i >= position) {
      break;
    }

    lastLineStart = i + match[0].length;
    line += 1;
  }

  return { line, column: position + 1 - lastLineStart };
}
