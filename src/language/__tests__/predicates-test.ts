import type { ASTNode } from '../ast';
import { KINDS } from '../kinds';
import {
  isTypeDefinitionNode,
  isTypeNode,
  isTypeSystemDefinitionNode,
} from '../predicates';

function filterNodes(predicate: (node: ASTNode) => boolean): Array<string> {
  return KINDS.filter((kind) => predicate({ kind: kind as any }));
}

describe('AST node predicates', () => {
  it('isTypeNode', () => {
    expect(filterNodes(isTypeNode)).toEqual([
      'NamedType',
      'ListType',
      'MaybeType',
    ]);
  });

  it('isTypeSystemDefinitionNode', () => {
    expect(filterNodes(isTypeSystemDefinitionNode)).toEqual([
      'DirectiveDefinition',
      'TypeDefinition',
    ]);
  });

  it('isTypeDefinitionNode', () => {
    expect(filterNodes(isTypeDefinitionNode)).toEqual(['TypeDefinition']);
  });
});
