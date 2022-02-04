import type { IrisNamedType, IrisType, IrisVariant } from './definition';
import { getNamedType } from './definition';
import type { GraphQLDirective } from './directives';
import { isDirective } from './directives';

export const collectAllReferencedTypes = (
  types: ReadonlyArray<IrisNamedType>,
  directives: ReadonlyArray<GraphQLDirective>,
): Set<IrisNamedType> => {
  const allReferencedTypes: Set<IrisNamedType> = new Set(types);

  types.forEach((type) => {
    allReferencedTypes.delete(type);
    collectReferencedTypes(type, allReferencedTypes);
  });

  collectDirectiveTypes(directives, allReferencedTypes);
  return allReferencedTypes;
};

const collectDirectiveTypes = (
  directives: ReadonlyArray<GraphQLDirective>,
  allReferencedTypes: Set<IrisNamedType>,
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
  typeSet: Set<IrisNamedType>,
): void {
  const namedType = getNamedType(type);

  if (typeSet.has(namedType)) {
    return;
  }

  typeSet.add(namedType);
  namedType
    .variants()
    .forEach((v) => exploreVariant(v as IrisVariant<'resolver'>, typeSet));
}

const exploreVariant = (
  variant: IrisVariant<'resolver'>,
  typeSet: Set<IrisNamedType>,
) => {
  if (variant.type) {
    collectReferencedTypes(variant.type, typeSet);
  }

  Object.values(variant.fields ?? {}).forEach((field) => {
    collectReferencedTypes(field.type, typeSet);
    field.args.forEach((arg) => collectReferencedTypes(arg.type, typeSet));
  });
};
