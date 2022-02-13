import type { IrisError } from '../error';
import type { DocumentNode } from '../types/ast';
import type { ASTVisitor } from '../types/visitor';

export class SDLValidationContext {
  private _ast: DocumentNode;
  private _onError: (error: IrisError) => void;

  constructor(ast: DocumentNode, onError: (error: IrisError) => void) {
    this._ast = ast;
    this._onError = onError;
  }

  get [Symbol.toStringTag]() {
    return 'SDLValidationContext';
  }

  reportError(error: IrisError): void {
    this._onError(error);
  }

  getDocument(): DocumentNode {
    return this._ast;
  }
}

export type SDLValidationRule = (context: SDLValidationContext) => ASTVisitor;
