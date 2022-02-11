import type { Role } from '../language/ast';

import type { IrisType, IrisTypeDefinition, IrisVariant } from './definition';
import { unwrapType } from './definition';
import type { GraphQLDirective } from './directives';
import { isDirective } from './directives';

export const collectAllReferencedTypes = (
  types: ReadonlyArray<IrisTypeDefinition>,
  directives: ReadonlyArray<GraphQLDirective>,
): Set<IrisTypeDefinition> => {
  const allReferencedTypes: Set<IrisTypeDefinition> = new Set(types);

  types.forEach((type) => {
    allReferencedTypes.delete(type);
    collectReferencedTypes(type, allReferencedTypes);
  });

  collectDirectiveTypes(directives, allReferencedTypes);
  return allReferencedTypes;
};

const collectDirectiveTypes = (
  directives: ReadonlyArray<GraphQLDirective>,
  allReferencedTypes: Set<IrisTypeDefinition>,
) => {
  for (const directive of directives) {
    // Directives are not validated until validateSchema() is called.
    if (isDirective(directive)) {
      directive.args.forEach((arg) =>
        collectReferencedTypes(arg.type, allReferencedTypes),
      );
    }
  }
};

function collectReferencedTypes(
  type: IrisType,
  typeSet: Set<IrisTypeDefinition>,
): void {
  const namedType = unwrapType(type);

  if (typeSet.has(namedType)) {
    return;
  }

  typeSet.add(namedType);
  namedType
    .variants()
    .forEach((v) => exploreVariant(v as IrisVariant<'resolver'>, typeSet));
}

const exploreVariant = (
  variant: IrisVariant<Role>,
  typeSet: Set<IrisTypeDefinition>,
) => {
  if (variant.type) {
    collectReferencedTypes(variant.type, typeSet);
  }

  Object.values(variant.fields ?? {}).forEach((field) => {
    collectReferencedTypes(field.type, typeSet);
    if ('args' in field) {
      field.args?.forEach?.((arg) => collectReferencedTypes(arg.type, typeSet));
    }
  });
};
