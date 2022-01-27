import { DirectiveLocation } from '../../language/directiveLocation';

import { GraphQLDirective } from '../directives';
import { GraphQLInt, GraphQLString } from '../scalars';

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
        foo: { type: GraphQLString },
        bar: { type: GraphQLInt },
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

  it('rejects a directive with incorrectly typed args', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: [DirectiveLocation.QUERY],
          // @ts-expect-error
          args: [],
        }),
    ).toThrow('@Foo args must be an object with argument names as keys.');
  });

  it('rejects a directive with incorrectly named arg', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: [DirectiveLocation.QUERY],
          args: {
            'bad-name': { type: GraphQLString },
          },
        }),
    ).toThrow('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });

  it('rejects a directive with undefined locations', () => {
    // @ts-expect-error
    expect(() => new GraphQLDirective({ name: 'Foo' })).toThrow(
      '@Foo locations must be an Array.',
    );
  });

  it('rejects a directive with incorrectly typed locations', () => {
    // @ts-expect-error
    expect(() => new GraphQLDirective({ name: 'Foo', locations: {} })).toThrow(
      '@Foo locations must be an Array.',
    );
  });
});
