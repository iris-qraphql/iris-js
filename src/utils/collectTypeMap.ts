import type {
  IrisTypeDefinition,
  IrisTypeRef,
  IrisVariant,
} from '../types/definition';
import type { GraphQLDirective } from '../types/directives';
import { isDirective } from '../types/directives';

import type { ObjMap } from './ObjMap';

export const unwrapType = (type: IrisTypeRef): IrisTypeDefinition =>
  type.kind === 'NAMED' ? type.ofType : unwrapType(type.ofType);

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
        collectReferencedTypes(unwrapType(arg.type), allReferencedTypes),
      );
    }
  }
};

function collectReferencedTypes(
  namedType: IrisTypeDefinition,
  typeSet: Set<IrisTypeDefinition>,
): void {
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
    collectReferencedTypes(unwrapType(field.type), typeSet);
    if ('args' in field) {
      field.args?.forEach?.((arg) =>
        collectReferencedTypes(unwrapType(arg.type), typeSet),
      );
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
