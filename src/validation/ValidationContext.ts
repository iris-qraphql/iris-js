import type { IrisError } from '../error';
import type { DocumentNode } from '../types/ast';
import type { ASTVisitor } from '../types/visitor';

export class IrisValidationContext {
  errors: Array<IrisError> = []
  private _ast: DocumentNode;
  

  constructor(ast: DocumentNode) {
    this._ast = ast;
  }

  get [Symbol.toStringTag]() {
    return 'SDLValidationContext';
  }

  reportError(error: IrisError): void {
    this.errors.push(error);
  }

  getDocument(): DocumentNode {
    return this._ast;
  }
}

export type SDLValidationRule = (context: IrisValidationContext) => ASTVisitor;
