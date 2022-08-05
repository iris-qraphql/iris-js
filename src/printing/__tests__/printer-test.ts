import { getDeprecationReason, getVariant } from '../../types/ast';
import { buildSchema, getType } from '../../types/schema';
import { dedent } from '../../utils/dedent';

import { print } from '../printer';

const cycle = (src: string) =>
  expect(print(buildSchema(src))).toEqual(dedent([src]));

describe('Type System: Schema', () => {
  it('Define sample schema', () => {
    cycle(`
      data Root = {
        article: Article
        feed: [Article]
      }

      data Article = {
        id: String
        isPublished: Boolean
        author: Author
        title: String
        body: String
      }

      data Author = {
        id: String
        name: String
        pic: Image
        recentArticle: Article
      }

      data Image = {
        url: String
        width: Int
        height: Int
      }
    `);
  });

  describe('Type Map', () => {
    it('includes data types only used in directives', () => {
      const schema = buildSchema(`
       data Foo 
       data Bar
       data Query = {}
      `);

      expect(Object.keys(schema.types)).toEqual(
        expect.arrayContaining(['Foo', 'Bar']),
      );
    });
  });
});

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
      data Type = Type {
        str: String
        int: Int
        float: Float
        id: ID
        bool: Boolean
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('include standard type only if it is used', () => {
    const schema = buildSchema('data Query');

    // String and Boolean are always included through introspection types
    expect(getType(schema, 'Int')).toEqual(undefined);
    expect(getType(schema, 'Float')).toEqual(undefined);
    expect(getType(schema, 'ID')).toEqual(undefined);
  });

  it('Supports descriptions', () => {
    const sdl = dedent`
      """This is a data type"""
      data Foo = Foo {
        """It has a field"""
        field: Int
      }

      """There is nothing inside!"""
      data BlackHole

      """With an Enum"""
      data Color = RED {} | GREEN {} | BLUE {}
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Type modifiers', () => {
    const sdl = dedent`
      data Type = Type {
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
      data Type = Type {
        str: String
        recurse: Type
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Two types circular', () => {
    const sdl = dedent`
      data One = One {
        str: String
        typeTwo: Two?
      }

      data Two = Two {
        str: String?
        typeOne: One
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
      data World = {
        str: String
      }

      data Hello = World
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Multiple Union', () => {
    const sdl = dedent`
      data Hello = WorldOne | WorldTwo

      data WorldOne = {
        str: String
      }

      data WorldTwo = {
        str: String
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

      data Type = {
        field1: String @deprecated
        field2: Int @deprecated(reason: "Because I said so")
        enum: MyEnum
        field5: String
      }
    `;

    expect(cycleSDL(sdl)).toEqual(sdl);

    const schema = buildSchema(sdl);

    expect(
      getType(schema, 'MyEnum')?.variants.map((variant) => ({
        name: variant.name.value,
        deprecation: getDeprecationReason(variant),
      })),
    ).toMatchSnapshot();

    const rootType = getType(schema, 'Type');
    const variant = rootType ? getVariant(rootType) : undefined;

    expect(
      variant?.fields?.map((f) => ({
        name: f.name.value,
        deprecation: getDeprecationReason(f),
      })),
    ).toMatchSnapshot();
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
