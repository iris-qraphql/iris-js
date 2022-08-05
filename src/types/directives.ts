import { Kind } from 'graphql';

import type { ArgumentDefinitionNode, DirectiveDefinitionNode } from './ast';
import { IrisDirectiveLocation, IrisKind } from './kinds';

export type GraphQLDirective = {
  name: string;
  description?: string;
  locations: ReadonlyArray<IrisDirectiveLocation>;
  args: ReadonlyArray<ArgumentDefinitionNode>;
  astNode?: DirectiveDefinitionNode;
};

export const specifiedDirectives: ReadonlyArray<GraphQLDirective> = Object.freeze([{
  name: 'deprecated',
  description: 'Marks an element of a GraphQL schema as no longer supported.',
  locations: [
    IrisDirectiveLocation.FIELD_DEFINITION,
    IrisDirectiveLocation.ARGUMENT_DEFINITION,
    IrisDirectiveLocation.VARIANT_DEFINITION,
  ],
  args: [
    {
      kind: IrisKind.ARGUMENT_DEFINITION,
      name: { value: 'reason', kind: Kind.NAME },
      description: {
        kind: Kind.STRING,
        value:
          'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
      },
      defaultValue: { value: '', kind: Kind.STRING },
      type: {
        kind: IrisKind.NAMED_TYPE,
        name: { value: 'string', kind: Kind.NAME },
      },
    },
  ],
}]);