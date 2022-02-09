import { dedent } from '../../utils/dedent';

import { printSchema } from '../printSchema';
import { buildSchema } from '../schema';

const cycle = (src: string) =>
  expect(printSchema(buildSchema(src))).toEqual(dedent([src]));

describe('Type System: Schema', () => {
  it('Define sample schema', () => {
    cycle(`
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
    it('includes data types only used in directives', () => {
      const schema = buildSchema(`
       data Foo 
       data Bar
       directive @Foo(arg: Foo, argList: [Bar] ) on OBJECT
       resolver Query = {}
      `);

      expect(Object.keys(schema.typeMap)).toEqual(
        expect.arrayContaining(['Foo', 'Bar']),
      );
    });
  });

  it('can be Object.toStringified', () => {
    const schema = buildSchema(`
      resolver Query = {}
    `);

    expect(Object.prototype.toString.call(schema)).toEqual(
      '[object IrisSchema]',
    );
  });

  describe('Validity', () => {
    describe('A Schema must contain uniquely named types', () => {
      // TODO:
      // it('rejects a Schema which redefines a built-in type', () => {
      //   const schema = buildSchema(`
      //       data String
      //       resolver Query = {
      //         fakeString: String
      //       }
      //   `);

      //   expect(schema).toEqual(
      //     'Schema must contain uniquely named types but contains multiple types named "String".',
      //   );
      // });

      it('rejects a Schema which defines an object type twice', () => {
        expect(() =>
          buildSchema(`
            resolver SameName
            resolver SameName
          `),
        ).toThrowErrorMatchingSnapshot();
      });
    });
  });
});
