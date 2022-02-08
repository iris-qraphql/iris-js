import { parseValue } from '../../language/parser';
import { visit } from '../../language/visitor';

import { buildSchema, IrisSchema } from '../../type/schema';

import { TypeInfo, visitWithTypeInfo } from '../TypeInfo';

describe('TypeInfo', () => {
  const schema = new IrisSchema({});

  it('can be Object.toStringified', () => {
    const typeInfo = new TypeInfo(schema);

    expect(Object.prototype.toString.call(typeInfo)).toEqual(
      '[object TypeInfo]',
    );
  });

  it('allow all methods to be called before entering any node', () => {
    const typeInfo = new TypeInfo(schema);

    expect(typeInfo.getType()).toEqual(undefined);
    expect(typeInfo.getParentType()).toEqual(undefined);
    expect(typeInfo.getInputType()).toEqual(undefined);
    expect(typeInfo.getParentInputType()).toEqual(undefined);
    expect(typeInfo.getFieldDef()).toEqual(undefined);
    expect(typeInfo.getDefaultValue()).toEqual(undefined);
    expect(typeInfo.getDirective()).toEqual(null);
    expect(typeInfo.getArgument()).toEqual(null);
    expect(typeInfo.getEnumValue()).toEqual(null);
  });
});

describe('visitWithTypeInfo', () => {
  it('supports traversals of input values', () => {
    const schema = buildSchema(`
      data  ComplexInput = {
        stringListField: [String]
      }
    `);
    const ast = parseValue('{ stringListField: ["foo"] }');
    const complexInputType = schema.getType('ComplexInput');

    const typeInfo = new TypeInfo(schema, complexInputType);

    const visited: Array<any> = [];
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const type = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
          ]);
        },
        leave(node) {
          const type = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
          ]);
        },
      }),
    );

    expect(visited).toEqual([
      ['enter', 'ObjectValue', null, 'ComplexInput'],
      ['enter', 'ObjectField', null, '[String]'],
      ['enter', 'Name', 'stringListField', '[String]'],
      ['leave', 'Name', 'stringListField', '[String]'],
      ['enter', 'ListValue', null, 'String'],
      ['enter', 'StringValue', null, 'String'],
      ['leave', 'StringValue', null, 'String'],
      ['leave', 'ListValue', null, 'String'],
      ['leave', 'ObjectField', null, '[String]'],
      ['leave', 'ObjectValue', null, 'ComplexInput'],
    ]);
  });
});
