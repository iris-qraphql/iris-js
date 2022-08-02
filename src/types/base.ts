export type Printable = {
  toString: () => string;
  toJSON: () => string;
  decode: <V>(v: unknown) => V;
};
