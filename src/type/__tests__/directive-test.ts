import { DirectiveLocation } from '../../language/directiveLocation';

import { GraphQLDirective } from '../directives';
import { IrisScalars } from '../scalars';

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
      args: {
        foo: { type: IrisScalars.String },
        bar: { type: IrisScalars.Int },
      },
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

  it('rejects a directive with incorrectly named arg', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: [DirectiveLocation.QUERY],
          args: {
            'bad-name': { type: IrisScalars.String },
          },
        }),
    ).toThrow('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });
});
