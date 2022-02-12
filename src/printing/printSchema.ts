import { Kind } from 'graphql';
import { isPrintableAsBlockString } from 'graphql/language/blockString';

import type {
  IrisArgument,
  IrisField,
  IrisTypeDefinition,
  IrisVariant,
} from '../types/definition';
import { isSpecifiedScalarType } from '../types/definition';
import type { GraphQLDirective } from '../types/directives';
import { isSpecifiedDirective } from '../types/directives';
import type { IrisSchema } from '../types/schema';
import type { Maybe } from '../utils/type-level';

import { print } from './printer';

export function printSchema(schema: IrisSchema): string {
  const directives = schema.directives.filter((n) => !isSpecifiedDirective(n));
  const types = Object.values(schema.typeMap).filter(
    (t) => !isSpecifiedScalarType(t),
  );

  return [
    ...directives.map((directive) => printDirective(directive)),
    ...types.map((type) => printType(type)),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function printType(type: IrisTypeDefinition): string {
  const variants = type.variants();
  const start = printDescription(type) + `${type.role} ${type.name}`;

  if (variants.length === 0) {
    return start;
  }

  if (type.isVariantType) {
    const [variant] = variants;
    const fields = Object.values(variant.fields ?? {});

    if (fields.length === 0 && variant.name === type.name) {
      return start;
    }

    return start + ' =' + printFields(fields);
  }

  return start + ' = ' + variants.map(printVariant).join(' | ');
}

const printVariant = (variant: IrisVariant): string =>
  printDescription(variant) +
  variant.name +
  printDeprecated(variant.deprecationReason) +
  (variant.fields ? ' ' + printFields(Object.values(variant.fields)) : '');

const printFields = (fields: ReadonlyArray<IrisField>): string =>
  printBlock(
    fields.map(
      (f, i) =>
        printDescription(f, '  ', !i) +
        '  ' +
        f.name +
        printArgs(f.args ?? [], '  ') +
        ': ' +
        String(f.type) +
        printDeprecated(f.deprecationReason),
    ),
  );

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
