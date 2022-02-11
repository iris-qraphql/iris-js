import type {
  IrisType,
  IrisTypeDefinition,
  IrisVariant,
} from '../type/definition';
import { unwrapType } from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import { isDirective } from '../type/directives';

import type { ObjMap } from './ObjMap';

const collectAllReferencedTypes = (
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
  variant: IrisVariant,
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

export type TypeMap = ObjMap<IrisTypeDefinition>;

export const collectTypeMap = (
  types: ReadonlyArray<IrisTypeDefinition>,
  directives: ReadonlyArray<GraphQLDirective>,
) => {
  const typeMap: TypeMap = {};

  collectAllReferencedTypes(types, directives).forEach((namedType) => {
    const { name } = namedType;

    if (!name) {
      throw new Error(
        'One of the provided types for building the Schema is missing a name.',
      );
    }

    if (typeMap[name] !== undefined) {
      throw new Error(
        `Iris Schema must contain uniquely named types but contains multiple types named "${name}".`,
      );
    }

    typeMap[name] = namedType;
  });

  return typeMap;
};
