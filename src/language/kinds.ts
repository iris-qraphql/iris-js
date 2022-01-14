import { Kind } from 'graphql';

export enum IrisKind {
  ARGUMENT_DEFINITION = 'InputValueDefinition',
  NAMED_TYPE = 'NamedType',
  LIST_TYPE = 'ListType',
  MAYBE_TYPE = 'MaybeType',
  FIELD_DEFINITION = 'FieldDefinition',
  VARIANT_DEFINITION = 'VariantDefinition',
  TYPE_DEFINITION = 'TypeDefinition',
  DIRECTIVE_DEFINITION = 'DirectiveDefinition',
  DOCUMENT = 'Document',
}

export type KIND = Kind | IrisKind;

export const KINDS: ReadonlyArray<KIND> = Object.values({
  ...Kind,
  ...IrisKind,
});
