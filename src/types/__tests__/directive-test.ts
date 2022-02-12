import { DirectiveLocation } from '../../language/directiveLocation';

import { IrisScalars } from '../definition';
import { GraphQLDirective } from '../directives';

describe('Type System: Directive', () => {
  it('defines a directive with no args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: [DirectiveLocation.QUERY],
    });

    expect({ ...directive }).toMatchSnapshot();
  });

  it('defines a directive with multiple args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      args: [
        { name: 'foo', type: IrisScalars.String },
        { name: 'bar', type: IrisScalars.Int },
      ],
      locations: [DirectiveLocation.QUERY],
    });

    expect({ ...directive }).toMatchSnapshot();
  });

  it('defines a repeatable directive', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      isRepeatable: true,
      locations: [DirectiveLocation.QUERY],
    });

    expect({ ...directive }).toMatchSnapshot();
  });

  it('can be stringified, JSON.stringified and Object.toStringified', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: [DirectiveLocation.QUERY],
    });

    expect(String(directive)).toEqual('@Foo');
    expect(JSON.stringify(directive)).toEqual('"@Foo"');
    expect(Object.prototype.toString.call(directive)).toEqual(
      '[object GraphQLDirective]',
    );
  });

  it('rejects a directive with invalid name', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'bad-name',
          locations: [DirectiveLocation.QUERY],
        }),
    ).toThrow('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });
});
