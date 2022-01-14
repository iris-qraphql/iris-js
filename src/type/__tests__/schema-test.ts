import { dedent } from '../../__testUtils__/dedent';

import { DirectiveLocation } from '../../language/directiveLocation';

import { printSchema } from '../../utilities/printSchema';

import {
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  IrisDataType,
} from '../definition';
import { GraphQLDirective } from '../directives';
import { GraphQLBoolean, GraphQLInt, GraphQLString } from '../scalars';
import { GraphQLSchema } from '../schema';

describe('Type System: Schema', () => {
  it('Define sample schema', () => {
    const BlogImage = new GraphQLObjectType({
      name: 'Image',
      fields: {
        url: { type: GraphQLString },
        width: { type: GraphQLInt },
        height: { type: GraphQLInt },
      },
    });

    const BlogAuthor: GraphQLObjectType = new GraphQLObjectType({
      name: 'Author',
      fields: () => ({
        id: { type: GraphQLString },
        name: { type: GraphQLString },
        pic: {
          args: { width: { type: GraphQLInt }, height: { type: GraphQLInt } },
          type: BlogImage,
        },
        recentArticle: { type: BlogArticle },
      }),
    });

    const BlogArticle: GraphQLObjectType = new GraphQLObjectType({
      name: 'Article',
      fields: {
        id: { type: GraphQLString },
        isPublished: { type: GraphQLBoolean },
        author: { type: BlogAuthor },
        title: { type: GraphQLString },
        body: { type: GraphQLString },
      },
    });

    const BlogQuery = new GraphQLObjectType({
      name: 'Query',
      fields: {
        article: {
          args: { id: { type: GraphQLString } },
          type: BlogArticle,
        },
        feed: {
          type: new GraphQLList(BlogArticle),
        },
      },
    });

    const BlogMutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        writeArticle: {
          type: BlogArticle,
        },
      },
    });

    const BlogSubscription = new GraphQLObjectType({
      name: 'Subscription',
      fields: {
        articleSubscribe: {
          args: { id: { type: GraphQLString } },
          type: BlogArticle,
        },
      },
    });

    const schema = new GraphQLSchema({
      description: 'Sample schema',
      query: BlogQuery,
      mutation: BlogMutation,
      subscription: BlogSubscription,
    });

    expect(printSchema(schema)).toEqual(dedent`
      resolver Query = {
        article(id: String): Article
        feed: [Article]
      }

      resolver Article = {
        id: String
        isPublished: Boolean
        author: Author
        title: String
        body: String
      }

      resolver Author = {
        id: String
        name: String
        pic(width: Int, height: Int): Image
        recentArticle: Article
      }

      resolver Image = {
        url: String
        width: Int
        height: Int
      }

      resolver Mutation = {
        writeArticle: Article
      }

      resolver Subscription = {
        articleSubscribe(id: String): Article
      }
    `);
  });

  describe('Type Map', () => {
    it('includes nested data  objects in the map', () => {
      const NestedInputObject = new IrisDataType({
        name: 'NestedInputObject',
        fields: {},
      });

      const SomeInputObject = new IrisDataType({
        name: 'SomeInputObject',
        fields: { nested: { type: NestedInputObject } },
      });

      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            something: {
              type: GraphQLString,
              args: { input: { type: SomeInputObject } },
            },
          },
        }),
      });

      expect(schema.getType('SomeInputObject')).toEqual(SomeInputObject);
      expect(schema.getType('NestedInputObject')).toEqual(NestedInputObject);
    });

    it('includes data types only used in directives', () => {
      const directive = new GraphQLDirective({
        name: 'dir',
        locations: [DirectiveLocation.OBJECT],
        args: {
          arg: {
            type: new IrisDataType({ name: 'Foo', fields: {} }),
          },
          argList: {
            type: new GraphQLList(
              new IrisDataType({ name: 'Bar', fields: {} }),
            ),
          },
        },
      });
      const schema = new GraphQLSchema({ directives: [directive] });

      expect(Object.keys(schema.getTypeMap())).toEqual(
        expect.arrayContaining(['Foo', 'Bar'])
        );
    });
  });

  it('can be Object.toStringified', () => {
    const schema = new GraphQLSchema({});

    expect(Object.prototype.toString.call(schema)).toEqual(
      '[object GraphQLSchema]',
    );
  });

  describe('Validity', () => {
    describe('when not assumed valid', () => {
      it('configures the schema to still needing validation', () => {
        expect(
          new GraphQLSchema({
            assumeValid: false,
          }).__validationErrors,
        ).toEqual(undefined);
      });

      it('checks the configuration for mistakes', () => {
        // @ts-expect-error
        expect(() => new GraphQLSchema(JSON.parse)).toThrow();
        // @ts-expect-error
        expect(() => new GraphQLSchema({ types: {} })).toThrow();
        // @ts-expect-error
        expect(() => new GraphQLSchema({ directives: {} })).toThrow();
      });
    });

    describe('A Schema must contain uniquely named types', () => {
      it('rejects a Schema which redefines a built-in type', () => {
        const FakeString = new GraphQLScalarType({ name: 'String' });

        const QueryType = new GraphQLObjectType({
          name: 'Query',
          fields: {
            normal: { type: GraphQLString },
            fake: { type: FakeString },
          },
        });

        expect(() => new GraphQLSchema({ query: QueryType })).toThrow(
          'Schema must contain uniquely named types but contains multiple types named "String".',
        );
      });

      it('rejects a Schema when a provided type has no name', () => {
        const query = new GraphQLObjectType({
          name: 'Query',
          fields: { foo: { type: GraphQLString } },
        });
        const types = [{}, query, {}];

        // @ts-expect-error
        expect(() => new GraphQLSchema({ query, types })).toThrow(
          'One of the provided types for building the Schema is missing a name.',
        );
      });

      it('rejects a Schema which defines an object type twice', () => {
        const types = [
          new GraphQLObjectType({ name: 'SameName', fields: {} }),
          new GraphQLObjectType({ name: 'SameName', fields: {} }),
        ];

        expect(() => new GraphQLSchema({ types })).toThrow(
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
        );
      });

      it('rejects a Schema which defines fields with conflicting types', () => {
        const fields = {};
        const QueryType = new GraphQLObjectType({
          name: 'Query',
          fields: {
            a: { type: new GraphQLObjectType({ name: 'SameName', fields }) },
            b: { type: new GraphQLObjectType({ name: 'SameName', fields }) },
          },
        });

        expect(() => new GraphQLSchema({ query: QueryType })).toThrow(
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
        );
      });
    });

    describe('when assumed valid', () => {
      it('configures the schema to have no errors', () => {
        expect(
          new GraphQLSchema({
            assumeValid: true,
          }).__validationErrors,
        ).toEqual([]);
      });
    });
  });
});
