import { isEmpty } from 'ramda';

import type {
  IrisField,
  IrisType,
  IrisTypeDefinition,
  IrisVariant,
} from '../types/definition';
import { isTypeRef } from '../types/definition';

const variantTypeName = (typeName: string, name: string) =>
  `${typeName}_${name}`;

const renderVariant =
  (typeName: string) =>
  ({ name, type, fields }: IrisVariant<'data'>) => {
    if (type) {
      return name;
    }

    if (isEmpty(fields)) {
      return `"${name}"`;
    }

    return variantTypeName(typeName, name);
  };

const isStandaloneVariantType = ({ type, fields }: IrisVariant<'data'>) =>
  !isEmpty(fields) && !type;

const renderTypeRef = (type: IrisType<'data'>): string => {
  if (isTypeRef(type)) {
    const content = renderTypeRef(type.ofType);

    switch (type.kind) {
      case 'MAYBE':
        return `?${content}`;

      case 'LIST':
        return `${content}[]`;
    }
  }

  return type.name;
};

const renderField = (name: string, { type }: IrisField<'data'>) =>
  `${name}: ${renderTypeRef(type)}`;

const renderVariantType =
  (typeName: string) =>
  ({ name, fields }: IrisVariant<'data'>) => {
    const fieldEntries = Object.entries(fields ?? {});
    const defName = variantTypeName(typeName, name);

    const fieldDefs = [
      `__typename: "${name}"`,
      ...fieldEntries.map((arg) => renderField(...arg)),
    ];

    return `@typedef {{ ${fieldDefs.join(', ')} }} ${defName}`;
  };

export const toJSODoc = (type: IrisTypeDefinition<'data'>) => {
  const variants = type.variants();
  const variantTypes = variants
    .filter(isStandaloneVariantType)
    .map(renderVariantType(type.name));

  const variantRefs = variants.map(renderVariant(type.name)).join(' | ');
  return [...variantTypes, `@type {(${variantRefs})}`].join('\n');
};
