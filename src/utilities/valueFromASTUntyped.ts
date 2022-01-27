import { Kind } from 'graphql';

import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';

import type { ValueNode } from '../language/ast';

/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * Unlike `valueFromAST()`, no type is provided. The resulting JavaScript value
 * will reflect the provided GraphQL value AST.
 *
 * | GraphQL Value        | JavaScript Value |
 * | -------------------- | ---------------- |
 * | Input Object         | Object           |
 * | List                 | Array            |
 * | Boolean              | Boolean          |
 * | String / Enum        | String           |
 * | Int / Float          | Number           |
 * | Null                 | null             |
 *
 */
export function valueFromASTUntyped(
  valueNode: ValueNode,
  variables?: Maybe<ObjMap<unknown>>,
): unknown {
  switch (valueNode.kind) {
    case Kind.NULL:
      return null;
    case Kind.INT:
      return parseInt(valueNode.value, 10);
    case Kind.FLOAT:
      return parseFloat(valueNode.value);
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.BOOLEAN:
      return valueNode.value;
    case Kind.LIST:
      return valueNode.values.map((node) =>
        valueFromASTUntyped(node, variables),
      );
    case Kind.OBJECT:
      return Object.fromEntries(
        valueNode.fields.map(({ name, value }) => [
          name.value,
          valueFromASTUntyped(value, variables),
        ]),
      );
    case Kind.VARIABLE:
      return variables?.[valueNode.name.value];
  }
}
