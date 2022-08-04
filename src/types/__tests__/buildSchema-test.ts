import { keys } from 'ramda';

import { print } from '../../printing/printer';
import { dedent } from '../../utils/dedent';

import { getField,getVariant} from '../ast';
import { GraphQLDeprecatedDirective } from '../directives';
import { scalars } from '../kinds';
import { buildSchema, getDirective, getType } from '../schema';

const cycleSDL = (sdl: string): string => print(buildSchema(sdl));

describe('Schema Builder', () => {
  it('Empty type', () => {
    const sdl = dedent`
      data EmptyType
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple type', () => {
    const sdl = dedent`
      data Query = {
        str: String
        int: Int
        float: Float
        id: ID
        bool: Boolean
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);

    const schema = buildSchema(sdl);



    for (const name of keys(scalars)) {
      expect(getType(schema, name)).toEqual(scalars[name]);
    }
  });

  it('include standard type only if it is used', () => {
    const schema = buildSchema('data Query');

    // String and Boolean are always included through introspection types
    expect(getType(schema, 'Int')).toEqual(undefined);
    expect(getType(schema, 'Float')).toEqual(undefined);
    expect(getType(schema, 'ID')).toEqual(undefined);
  });

  it('With directives', () => {
    const sdl = dedent`
      directive @foo(arg: Int) on FIELD

      directive @repeatableFoo(arg: Int) repeatable on FIELD
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Supports descriptions', () => {
    const sdl = dedent`
      """This is a directive"""
      directive @foo(
        """It has an argument"""
        arg: Int
      ) on FIELD

      """Who knows what inside this scalar?"""
      data MysteryScalar = Int

      """This is a data  object type"""
      data FooInput = {
        """It has a field"""
        field: Int
      }

      """There is nothing inside!"""
      data BlackHole

      """With an Enum"""
      data Color = RED {} | GREEN {} | BLUE {}

      """What a great type"""
      data Query = {
        """And a field to boot"""
        str: String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Overriding directives excludes specified', () => {
    const schema = buildSchema(`
      directive @skip on FIELD
      directive @include on FIELD
      directive @deprecated on FIELD_DEFINITION
      directive @specifiedBy on FIELD_DEFINITION
    `);

    expect(schema.directives).toHaveLength(4);
    expect(getDirective(schema, 'deprecated')).not.toEqual(
      GraphQLDeprecatedDirective,
    );
  });

  it('Type modifiers', () => {
    const sdl = dedent`
      data Query = {
        nonNullStr: String?
        listOfStrings: [String]
        listOfNonNullStrings: [String?]
        nonNullListOfStrings: [String]?
        nonNullListOfNonNullStrings: [String?]?
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Recursive type', () => {
    const sdl = dedent`
      data Query = {
        str: String
        recurse: Query
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Two types circular', () => {
    const sdl = dedent`
      data TypeOne = {
        str: String
        typeTwo: TypeTwo?
      }

      data TypeTwo = {
        str: String?
        typeOne: TypeOne
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Empty Enum', () => {
    const sdl = dedent`
      data EmptyEnum
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple output Enum', () => {
    const sdl = dedent`
      data Hello = WORLD {}
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Multiple value Enum', () => {
    const sdl = dedent`
      data Hello = WO {} | RLD {}
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Empty union', () => {
    const sdl = dedent`
      data EmptyUnion
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple Union', () => {
    const sdl = dedent`
      data Hello = World

      data Query = {
        hello: Hello
      }

      data World = {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Multiple Union', () => {
    const sdl = dedent`
      data Hello = WorldOne | WorldTwo

      data Query = {
        hello: Hello
      }

      data WorldOne = {
        str: String
      }

      data WorldTwo = {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Custom Scalar', () => {
    const sdl = dedent`
      data CustomScalar = Int

      data Query = {
        customScalar: CustomScalar
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Empty Input Object', () => {
    const sdl = dedent`
      data EmptyInputObject
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple Input Object', () => {
    const sdl = dedent`
      data Type = Type {
        str: String
        int: Int
        bool: Boolean
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Unreferenced type implementing referenced union', () => {
    const sdl = dedent`
      data Concrete = {
        key: String
      }

      data Query = {
        union: Union
      }

      data Union = Concrete
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Supports @deprecated', () => {
    const sdl = dedent`
      data MyEnum = VALUE {} | OLD_VALUE @deprecated {} | OTHER_VALUE @deprecated(reason: "Terrible reasons") {}

      data MyInput = {
        oldInput: String? @deprecated
        otherInput: String @deprecated(reason: "Use newInput")
        newInput: String
      }

      data Query = {
        field1: String @deprecated
        field2: Int @deprecated(reason: "Because I said so")
        enum: MyEnum
        field5: String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);

    const schema = buildSchema(sdl);

    expect(
      getType(schema, 'MyEnum')?.variants.map(({ name, deprecation }) => ({ name, deprecation })),
    ).toEqual([
      { name: 'VALUE', deprecation: undefined },
      { name: 'OLD_VALUE', deprecation: '' },
      { name: 'OTHER_VALUE', deprecation: 'Terrible reasons' },
    ]);

    const rootType = getType(schema, 'Query');
    const variant = rootType ? getVariant(rootType): undefined;
    
    expect(getField('field1',variant)).toEqual(
      expect.objectContaining({
        deprecationReason: '',
      }),
    );
    expect(getField('field2',variant)).toEqual(
      expect.objectContaining({
        deprecationReason: 'Because I said so',
      }),
    );
  });

  it('Do not override standard types', () => {
    // NOTE: not sure it's desired behavior to just silently ignore override
    // attempts so just documenting it here.

    const schema = buildSchema(`
      data ID = String
    `);

    expect(getType(schema, 'ID')).toEqual(scalars.ID);
  });

  it('Rejects invalid SDL', () => {
    const sdl = `
      data Query = {
        foo: String @unknown
      }
    `;
    expect(() => buildSchema(sdl)).toThrow('Unknown directive "@unknown".');
  });
});
