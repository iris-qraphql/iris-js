import { GraphQLDirective } from '../directives';
import { IrisDirectiveLocation } from '../kinds';

describe('Type System: Directive', () => {
  it('defines a directive with no args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: [IrisDirectiveLocation.QUERY],
    });

    expect({ ...directive }).toMatchSnapshot();
  });

  it('defines a repeatable directive', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      isRepeatable: true,
      locations: [IrisDirectiveLocation.QUERY],
    });

    expect({ ...directive }).toMatchSnapshot();
  });

  it('can be stringified, JSON.stringified and Object.toStringified', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: [IrisDirectiveLocation.QUERY],
    });

    expect(String(directive)).toEqual('@Foo');
    expect(JSON.stringify(directive)).toEqual('"@Foo"');
    expect(Object.prototype.toString.call(directive)).toEqual(
      '[object GraphQLDirective]',
    );
  });
});
