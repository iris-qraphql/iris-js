import { irisError } from '../../error';
import { isTypeVariantNode } from '../../types/ast';
import type { ASTVisitor } from '../../types/visitor';

import type { IrisValidationContext } from '../ValidationContext';

export const ObjectRootTypes = (ctx: IrisValidationContext): ASTVisitor => ({
  TypeDefinition(type) {
    const typeName = type.name.value;
    if (['Query', 'Mutation', 'Subscription'].includes(typeName)) {
      if (!(type.role === 'resolver' && isTypeVariantNode(type))) {
        const optionalMessage = typeName === 'Query' ? '' : ' if provided';
        ctx.reportError(
          irisError(
            `${typeName} root type must be Object type${optionalMessage}, it cannot be ${typeName}.`,
            { nodes: type.name },
          ),
        );
      }
    }
  },
});
