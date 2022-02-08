import { IrisKind } from '../../language/kinds';

import { dedent } from '../../utils/dedent';

import { assertDataType, assertResolverType } from '../definition';
import { GraphQLDeprecatedDirective } from '../directives';
import { printSchema } from '../printSchema';
import { IrisBool, IrisFloat, IrisID, IrisInt, IrisString } from '../scalars';
import { buildASTSchema, buildSchema, IrisSchema } from '../schema';
import { validateSchema } from '../validate';

/**
 * This function does a full cycle of going from a string with the contents of
 * the SDL, parsed in a schema AST, materializing that schema AST into an
 * in-memory IrisSchema, and then finally printing that object into the SDL
 */
function cycleSDL(sdl: string): string {
  return printSchema(buildSchema(sdl));
}

describe('Schema Builder', () => {
  it('Match order of default types and directives', () => {
    const schema = new IrisSchema({});
    const sdlSchema = buildASTSchema({
      kind: IrisKind.DOCUMENT,
      definitions: [],
    });

    expect(sdlSchema.directives).toEqual(schema.directives);

    expect(sdlSchema.typeMap).toEqual(schema.typeMap);
    expect(Object.keys(sdlSchema.typeMap)).toEqual(Object.keys(schema.typeMap));
  });

  it('Empty type', () => {
    const sdl = dedent`
      resolver EmptyType
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple type', () => {
    const sdl = dedent`
      resolver Query = {
        str: String
        int: Int
        float: Float
        id: ID
        bool: Boolean
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);

    const schema = buildSchema(sdl);
    // Built-ins are used
    expect(schema.getType('Int')).toEqual(IrisInt);
    expect(schema.getType('Float')).toEqual(IrisFloat);
    expect(schema.getType('String')).toEqual(IrisString);
    expect(schema.getType('Boolean')).toEqual(IrisBool);
    expect(schema.getType('ID')).toEqual(IrisID);
  });

  it('include standard type only if it is used', () => {
    const schema = buildSchema('resolver Query');

    // String and Boolean are always included through introspection types
    expect(schema.getType('Int')).toEqual(undefined);
    expect(schema.getType('Float')).toEqual(undefined);
    expect(schema.getType('ID')).toEqual(undefined);
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
      resolver BlackHole

      """With an Enum"""
      data Color = RED {} | GREEN {} | BLUE {}

      """What a great type"""
      resolver Query = {
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
    expect(schema.getDirective('deprecated')).not.toEqual(
      GraphQLDeprecatedDirective,
    );
  });

  it('Type modifiers', () => {
    const sdl = dedent`
      resolver Query = {
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
      resolver Query = {
        str: String
        recurse: Query
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Two types circular', () => {
    const sdl = dedent`
      resolver TypeOne = {
        str: String
        typeTwo: TypeTwo?
      }

      resolver TypeTwo = {
        str: String?
        typeOne: TypeOne
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Single argument field', () => {
    const sdl = dedent`
      resolver Query = {
        str(int: Int?): String
        floatToStr(float: Float): String
        idToStr(id: ID?): String
        booleanToStr(bool: Boolean?): String
        strToStr(bool: String): String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple type with multiple arguments', () => {
    const sdl = dedent`
      resolver Query = {
        str(int: Int, bool: Boolean): String
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

      resolver Query = {
        hello: Hello
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple Enum argument', () => {
    const sdl = dedent`
      data Hello = WORLD {}

      resolver Query = {
        str(hello: Hello): String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Multiple value Enum', () => {
    const sdl = dedent`
      data Hello = WO {} | RLD {}

      resolver Query = {
        hello: Hello
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Empty union', () => {
    const sdl = dedent`
      resolver EmptyUnion
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple Union', () => {
    const sdl = dedent`
      resolver Hello = World

      resolver Query = {
        hello: Hello
      }

      resolver World = {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Multiple Union', () => {
    const sdl = dedent`
      resolver Hello = WorldOne | WorldTwo

      resolver Query = {
        hello: Hello
      }

      resolver WorldOne = {
        str: String
      }

      resolver WorldTwo = {
        str: String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it("can't build recursive Union", () => {
    const schema = buildSchema(`
      resolver Hello = Hello

      resolver Query = {
        hello: Hello
      }
    `);
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('Custom Scalar', () => {
    const sdl = dedent`
      data CustomScalar = Int

      resolver Query = {
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
      data Input = {
        int: Int
      }

      resolver Query = {
        field(in: Input): String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple argument field with default', () => {
    const sdl = dedent`
      resolver Query = {
        str(int: Int = 2): String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Custom int argument field with default', () => {
    const sdl = dedent`
      data CustomScalar = Int

      resolver Query = {
        str(int: CustomScalar = 2): String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Simple type with mutation', () => {
    const sdl = dedent`
      resolver Query = {
        str: String
        int: Int
        bool: Boolean
      }

      resolver Mutation = {
        addHelloScalars(str: String, int: Int, bool: Boolean): Query
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);
  });

  it('Unreferenced type implementing referenced union', () => {
    const sdl = dedent`
      resolver Concrete = {
        key: String
      }

      resolver Query = {
        union: Union
      }

      resolver Union = Concrete
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

      resolver Query = {
        field1: String @deprecated
        field2: Int @deprecated(reason: "Because I said so")
        enum: MyEnum
        field3(oldArg: String @deprecated, arg: String): String
        field4(oldArg: String @deprecated(reason: "Why not?"), arg: String): String
        field5(arg: MyInput): String
      }
    `;
    expect(cycleSDL(sdl)).toEqual(sdl);

    const schema = buildSchema(sdl);

    const myEnum = assertDataType(schema.getType('MyEnum'));

    const value = myEnum.variantBy('VALUE');
    expect(value).toEqual(
      expect.objectContaining({ deprecationReason: undefined }),
    );

    const oldValue = myEnum.variantBy('OLD_VALUE');
    expect(oldValue).toEqual(
      expect.objectContaining({
        deprecationReason: '',
      }),
    );

    const otherValue = myEnum.variantBy('OTHER_VALUE');
    expect(otherValue).toEqual(
      expect.objectContaining({
        deprecationReason: 'Terrible reasons',
      }),
    );

    const rootFields =
      assertResolverType(schema.getType('Query')).variantBy().fields ?? {};

    expect(rootFields.field1).toEqual(
      expect.objectContaining({
        deprecationReason: '',
      }),
    );
    expect(rootFields.field2).toEqual(
      expect.objectContaining({
        deprecationReason: 'Because I said so',
      }),
    );

    const field3OldArg = rootFields.field3.args[0];
    expect(field3OldArg).toEqual(
      expect.objectContaining({
        deprecationReason: '',
      }),
    );

    const field4OldArg = rootFields.field4.args[0];
    expect(field4OldArg).toEqual(
      expect.objectContaining({
        deprecationReason: 'Why not?',
      }),
    );
  });

  it('can build invalid schema', () => {
    // Invalid schema, because it is missing query root type
    const schema = buildSchema('resolver Mutation');
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('Do not override standard types', () => {
    // NOTE: not sure it's desired behavior to just silently ignore override
    // attempts so just documenting it here.

    const schema = buildSchema(`
      data ID = String
    `);

    expect(schema.getType('ID')).toEqual(IrisID);
  });

  it('Rejects invalid SDL', () => {
    const sdl = `
      resolver Query = {
        foo: String @unknown
      }
    `;
    expect(() => buildSchema(sdl)).toThrow('Unknown directive "@unknown".');
  });

  it('Allows to disable SDL validation', () => {
    const sdl = `
      resolver Query = {
        foo: String @unknown
      }
    `;
    buildSchema(sdl, { assumeValid: true });
    buildSchema(sdl, { assumeValidSDL: true });
  });

  it('Throws on unknown types', () => {
    const sdl = `
      resolver Query = {
        unknown: UnknownType
      }
    `;
    expect(() => buildSchema(sdl, { assumeValidSDL: true })).toThrow(
      'Unknown type: "UnknownType".',
    );
  });
});
