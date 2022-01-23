import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';

import { isPrintableAsBlockString } from '../language/blockString';
import { Kind } from '../language/kinds';
import { print } from '../language/printer';

import type {
  GraphQLArgument,
  GraphQLFieldMap,
  GraphQLInputField,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  IrisDataType,
  IrisDataVariant,
  IrisDataVariantField,
} from '../type/definition';
import {
  isEnumType,
  isInputObjectType,
  isObjectType,
  isScalarType,
  isUnionType,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import {
  DEFAULT_DEPRECATION_REASON,
  isSpecifiedDirective,
} from '../type/directives';
import { isIntrospectionType } from '../type/introspection';
import { isSpecifiedScalarType } from '../type/scalars';
import type { GraphQLSchema } from '../type/schema';

import { astFromValue } from './astFromValue';

export function printSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(
    schema,
    (n) => !isSpecifiedDirective(n),
    isDefinedType,
  );
}

export function printIntrospectionSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType);
}

function isDefinedType(type: GraphQLNamedType): boolean {
  return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}

function printFilteredSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: GraphQLDirective) => boolean,
  typeFilter: (type: GraphQLNamedType) => boolean,
): string {
  const directives = schema.getDirectives().filter(directiveFilter);
  const types = Object.values(schema.getTypeMap()).filter(typeFilter);

  return [
    ...directives.map((directive) => printDirective(directive)),
    ...types.map((type) => printType(type)),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function printType(type: GraphQLNamedType): string {
  if (isScalarType(type)) {
    return printScalar(type);
  }
  if (isObjectType(type)) {
    return printObject(type);
  }
  if (isUnionType(type)) {
    return printUnion(type);
  }
  if (isEnumType(type) || isInputObjectType(type)) {
    return printDATA(type);
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  invariant(false, 'Unexpected type: ' + inspect(type));
}

function printScalar(type: GraphQLScalarType): string {
  return (
    printDescription(type) + `scalar ${type.name}` + printSpecifiedByURL(type)
  );
}

function printObject(type: GraphQLObjectType): string {
  const fields = type.getFields();
  return (
    printDescription(type) +
    `resolver ${type.name}${
      Object.keys(fields).length > 0 ? ' =' : ''
    }${printFields(fields)}`
  );
}

function printUnion(type: GraphQLUnionType): string {
  const types = type.getTypes();
  const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
  return printDescription(type) + 'resolver ' + type.name + possibleTypes;
}

function printDATA(type: IrisDataType): string {
  const variants = type.getVariants();
  const firstVariant = variants[0];
  const isEmptyType =
    !firstVariant ||
    ((firstVariant.fields?.length ?? 0) === 0 &&
      firstVariant.name === type.name);

  const start =
    printDescription(type) + `data ${type.name}` + (!isEmptyType ? ' = ' : '');

  if (type.isVariantType()) {
    return start + printDataFields(variants[0]?.fields ?? {});
  }

  return start + variants.map(printDataVariant).join(' | ');
}

function printDataFields(fields: ObjMap<IrisDataVariantField>): string {
  return printBlock(
    Object.values(fields).map(
      (f, i) => printDescription(f, '  ', !i) + '  ' + printInputValue(f),
    ),
  );
}
function printDataVariant(variant: IrisDataVariant): string {
  return (
    printDescription(variant) +
    variant.name +
    printDeprecated(variant.deprecationReason) +
    (variant.fields ? printDataFields(variant.fields) : '')
  );
}

function printFields(fs: GraphQLFieldMap<any, any>): string {
  const fields = Object.values(fs).map(
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
}

function printBlock(items: ReadonlyArray<string>): string {
  return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}

function printArgs(
  args: ReadonlyArray<GraphQLArgument>,
  indentation: string = '',
): string {
  if (args.length === 0) {
    return '';
  }

  // If every arg does not have a description, print them on one line.
  if (args.every((arg) => !arg.description)) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return (
    '(\n' +
    args
      .map(
        (arg, i) =>
          printDescription(arg, '  ' + indentation, !i) +
          '  ' +
          indentation +
          printInputValue(arg),
      )
      .join('\n') +
    '\n' +
    indentation +
    ')'
  );
}

function printInputValue(arg: GraphQLInputField): string {
  const defaultAST = astFromValue(arg.defaultValue, arg.type);
  let argDecl = arg.name + ': ' + String(arg.type);
  if (defaultAST) {
    argDecl += ` = ${print(defaultAST)}`;
  }
  return argDecl + printDeprecated(arg.deprecationReason);
}

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
  if (reason !== DEFAULT_DEPRECATION_REASON) {
    const astValue = print({ kind: Kind.STRING, value: reason });
    return ` @deprecated(reason: ${astValue})`;
  }
  return ' @deprecated';
}

function printSpecifiedByURL(scalar: GraphQLScalarType): string {
  if (scalar.specifiedByURL == null) {
    return '';
  }
  const astValue = print({
    kind: Kind.STRING,
    value: scalar.specifiedByURL,
  });
  return ` @specifiedBy(url: ${astValue})`;
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
