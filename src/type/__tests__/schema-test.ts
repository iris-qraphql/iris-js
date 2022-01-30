import { DirectiveLocation } from '../../language/directiveLocation';

import { printSchema } from '../../utilities/printSchema';

import { dedent } from '../../utils/dedent';

import type { IrisResolverType } from '../definition';
import { GraphQLDirective } from '../directives';
import {
  emptyDataType,
  gqlInput,
  gqlList,
  gqlObject,
  gqlScalar,
} from '../make';
import { IrisBool, IrisInt, IrisString } from '../scalars';
import { GraphQLSchema } from '../schema';

describe('Type System: Schema', () => {
  it('Define sample schema', () => {
    const BlogImage = gqlObject({
      name: 'Image',
      fields: {
        url: { type: IrisString },
        width: { type: IrisInt },
        height: { type: IrisInt },
      },
    });

    const BlogAuthor: IrisResolverType = gqlObject({
      name: 'Author',
      fields: () => ({
        id: { type: IrisString },
        name: { type: IrisString },
        pic: {
          args: { width: { type: IrisInt }, height: { type: IrisInt } },
          type: BlogImage,
        },
        recentArticle: { type: BlogArticle },
      }),
    });

    const BlogArticle: IrisResolverType = gqlObject({
      name: 'Article',
      fields: {
        id: { type: IrisString },
        isPublished: { type: IrisBool },
        author: { type: BlogAuthor },
        title: { type: IrisString },
        body: { type: IrisString },
      },
    });

    const BlogQuery = gqlObject({
      name: 'Query',
      fields: {
        article: {
          args: { id: { type: IrisString } },
          type: BlogArticle,
        },
        feed: {
          type: gqlList(BlogArticle),
        },
      },
    });

    const BlogMutation = gqlObject({
      name: 'Mutation',
      fields: {
        writeArticle: {
          type: BlogArticle,
        },
      },
    });

    const BlogSubscription = gqlObject({
      name: 'Subscription',
      fields: {
        articleSubscribe: {
          args: { id: { type: IrisString } },
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
      const NestedInputObject = emptyDataType('NestedInputObject');

      const SomeInputObject = gqlInput({
        name: 'SomeInputObject',
        fields: { nested: { type: NestedInputObject } },
      });

      const schema = new GraphQLSchema({
        query: gqlObject({
          name: 'Query',
          fields: {
            something: {
              type: IrisString,
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
            type: emptyDataType('Foo'),
          },
          argList: {
            type: gqlList(emptyDataType('Bar')),
          },
        },
      });
      const schema = new GraphQLSchema({ directives: [directive] });

      expect(Object.keys(schema.getTypeMap())).toEqual(
        expect.arrayContaining(['Foo', 'Bar']),
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
        const FakeString = gqlScalar({ name: 'String' });

        const QueryType = gqlObject({
          name: 'Query',
          fields: {
            normal: { type: IrisString },
            fake: { type: FakeString },
          },
        });

        expect(() => new GraphQLSchema({ query: QueryType })).toThrow(
          'Schema must contain uniquely named types but contains multiple types named "String".',
        );
      });

      it('rejects a Schema when a provided type has no name', () => {
        const query = gqlObject({
          name: 'Query',
          fields: { foo: { type: IrisString } },
        });
        const types = [{}, query, {}];

        // @ts-expect-error
        expect(() => new GraphQLSchema({ query, types })).toThrow(
          'One of the provided types for building the Schema is missing a name.',
        );
      });

      it('rejects a Schema which defines an object type twice', () => {
        const types = [
          gqlObject({ name: 'SameName', fields: {} }),
          gqlObject({ name: 'SameName', fields: {} }),
        ];

        expect(() => new GraphQLSchema({ types })).toThrow(
          'Schema must contain uniquely named types but contains multiple types named "SameName".',
        );
      });

      it('rejects a Schema which defines fields with conflicting types', () => {
        const fields = {};
        const QueryType = gqlObject({
          name: 'Query',
          fields: {
            a: { type: gqlObject({ name: 'SameName', fields }) },
            b: { type: gqlObject({ name: 'SameName', fields }) },
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
