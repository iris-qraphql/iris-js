import { Kind } from 'graphql';
import { isPrintableAsBlockString } from 'graphql/language/blockString';
import { pluck } from 'ramda';

import type { Role } from '../language/ast';
import { print } from '../language/printer';

import type { Maybe } from '../utils/type-level';

import type {
  IrisArgument,
  IrisField,
  IrisNamedType,
  IrisTypeDefinition,
  IrisVariant,
} from './definition';
import type { GraphQLDirective } from './directives';
import { isSpecifiedDirective } from './directives';
import { isSpecifiedScalarType } from './scalars';
import type { IrisSchema } from './schema';

export function printSchema(schema: IrisSchema): string {
  return printFilteredSchema(
    schema,
    (n) => !isSpecifiedDirective(n),
    isDefinedType,
  );
}

function isDefinedType(type: IrisNamedType): boolean {
  return !isSpecifiedScalarType(type);
}

function printFilteredSchema(
  schema: IrisSchema,
  directiveFilter: (type: GraphQLDirective) => boolean,
  typeFilter: (type: IrisNamedType) => boolean,
): string {
  const directives = schema.directives.filter(directiveFilter);
  const types = Object.values(schema.typeMap).filter(typeFilter);

  return [
    ...directives.map((directive) => printDirective(directive)),
    ...types.map((type) => printType(type)),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function printType(type: IrisTypeDefinition<Role>): string {
  switch (type.role) {
    case 'resolver':
      return printResolver(type as IrisTypeDefinition<'resolver'>);
    case 'data':
      return printDATA(type as IrisTypeDefinition<'data'>);
  }
}

function printResolver(type: IrisTypeDefinition<'resolver'>): string {
  const variants = type.variants();
  const start = printDescription(type) + `resolver ${type.name}`;

  if (variants.length === 0) {
    return start;
  }

  if (type.isVariantType()) {
    const variant = variants[0];
    const fields = Object.values(variant.fields ?? {});
    if (fields.length === 0 && variant.name === type.name) {
      return start;
    }

    return start + ' =' + printFields(fields);
  }

  return start + ' = ' + pluck('name', variants).join(' | ');
}

function printDATA(type: IrisTypeDefinition<'data'>): string {
  const variants = type.variants();
  const start = printDescription(type) + `data ${type.name}`;

  if (variants.length === 0) {
    return start;
  }

  if (type.isVariantType()) {
    const variant = variants[0];
    const fields = Object.values(variant.fields ?? {});

    if (fields.length === 0 && variant.name === type.name) {
      return start;
    }

    return start + ' =' + printDataFields(fields);
  }

  return start + ' = ' + variants.map(printDataVariant).join(' | ');
}

const printDataVariant = (variant: IrisVariant<'data'>): string =>
  printDescription(variant) +
  variant.name +
  printDeprecated(variant.deprecationReason) +
  (variant.fields ? ' ' + printDataFields(Object.values(variant.fields)) : '');

const printDataFields = (fields: ReadonlyArray<IrisField<'data'>>): string =>
  printBlock(
    fields.map(
      (f, i) =>
        printDescription(f, '  ', !i) +
        '  ' +
        f.name +
        ': ' +
        String(f.type) +
        printDeprecated(f.deprecationReason),
    ),
  );

const printFields = (fs: ReadonlyArray<IrisField<'resolver'>>): string => {
  const fields = fs.map(
    (f, i) =>
      printDescription(f, '  ', !i) +
      '  ' +
      f.name +
      printArgs(f.args, '  ') +
      ': ' +
      String(f.type) +
      printDeprecated(f.deprecationReason),
  );
  return printBlock(fields);
};

const printBlock = (items: ReadonlyArray<string>): string =>
  items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '{}';

function printArgs(
  args: ReadonlyArray<IrisArgument>,
  indentation: string = '',
): string {
  if (args.length === 0) {
    return '';
  }

  // If every arg does not have a description, print them on one line.
  if (args.every((arg) => !arg.description)) {
    return '(' + args.map(printArgument).join(', ') + ')';
  }

  return (
    '(\n' +
    args
      .map(
        (arg, i) =>
          printDescription(arg, '  ' + indentation, !i) +
          '  ' +
          indentation +
          printArgument(arg),
      )
      .join('\n') +
    '\n' +
    indentation +
    ')'
  );
}

const printArgument = ({
  name,
  type,
  deprecationReason,
  astNode,
}: IrisArgument): string => {
  const printedDefaultValue = astNode?.defaultValue
    ? ` = ${print(astNode.defaultValue)}`
    : '';

  return `${name}: ${type.toString()}${printedDefaultValue}${printDeprecated(
    deprecationReason,
  )}`;
};

function printDirective(directive: GraphQLDirective): string {
  return (
    printDescription(directive) +
    'directive @' +
    directive.name +
    printArgs(directive.args) +
    (directive.isRepeatable ? ' repeatable' : '') +
    ' on ' +
    directive.locations.join(' | ')
  );
}

function printDeprecated(reason: Maybe<string>): string {
  if (reason == null) {
    return '';
  }
  if (reason) {
    const astValue = print({ kind: Kind.STRING, value: reason });
    return ` @deprecated(reason: ${astValue})`;
  }
  return ' @deprecated';
}

function printDescription(
  def: { readonly description?: Maybe<string> },
  indentation: string = '',
  firstInBlock: boolean = true,
): string {
  const { description } = def;
  if (description == null) {
    return '';
  }

  const blockString = print({
    kind: Kind.STRING,
    value: description,
    block: isPrintableAsBlockString(description),
  });

  const prefix =
    indentation && !firstInBlock ? '\n' + indentation : indentation;

  return prefix + blockString.replace(/\n/g, '\n' + indentation) + '\n';
}
