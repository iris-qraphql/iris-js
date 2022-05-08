import type { WrapperKind } from './ast';
import type { Printable } from './base';

export class IrisTypeRefImp<K extends WrapperKind, T extends Printable> {
  readonly ofType: T;
  readonly kind: K;

  constructor(kind: K, ofType: T) {
    this.kind = kind;
    this.ofType = ofType;
  }

  get [Symbol.toStringTag]() {
    return 'IrisTypeRef';
  }

  toString(): string {
    const type = this.ofType.toString();
    switch (this.kind) {
      case 'LIST':
        return '[' + type + ']';
      case 'MAYBE':
        return type + '?';
      default:
        return type;
    }
  }

  toJSON(): string {
    return this.toString();
  }
}
