import { print } from '../../printing/printer';
import { dedent } from '../../utils/dedent';

import { buildSchema } from '../schema';

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

  describe('Validity', () => {
    describe('A Schema must contain uniquely named types', () => {

      it('rejects a Schema which redefines a built-in type', () => {
        const schema = buildSchema(`
            data String
            data Query = {
              fakeString: String
            }
        `);

        expect(schema).toEqual(
          'Schema must contain uniquely named types but contains multiple types named "String".',
        );
      });

      it('rejects a Schema which defines an object type twice', () => {
        expect(() =>
          buildSchema(`
            data SameName
            data SameName
          `),
        ).toThrowErrorMatchingSnapshot();
      });
    });
  });
});
