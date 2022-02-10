import type { DocumentNode } from '../language/ast';
import type { ASTVisitor } from '../language/visitor';

import type { IrisSchema } from '../type/schema';

import type { IrisError } from '../error';
import type { Maybe } from '../utils/type-level';

export class SDLValidationContext {
  private _ast: DocumentNode;
  private _onError: (error: IrisError) => void;
  private _schema: Maybe<IrisSchema>;

  constructor(
    ast: DocumentNode,
    schema: Maybe<IrisSchema>,
    onError: (error: IrisError) => void,
  ) {
    this._ast = ast;
    this._onError = onError;
    this._schema = schema;
  }

  get [Symbol.toStringTag]() {
    return 'SDLValidationContext';
  }

  reportError(error: IrisError): void {
    this._onError(error);
  }

  getSchema(): Maybe<IrisSchema> {
    return this._schema;
  }

  getDocument(): DocumentNode {
    return this._ast;
  }
}

export type SDLValidationRule = (context: SDLValidationContext) => ASTVisitor;
