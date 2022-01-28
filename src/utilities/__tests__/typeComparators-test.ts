import type { ObjMap } from '../../jsutils/ObjMap';

import type { GraphQLFieldConfig } from '../../type/definition';
import { GraphQLList, GraphQLNonNull } from '../../type/definition';
import { gqlObject, gqlUnion } from '../../type/make';
import { GraphQLFloat, GraphQLInt, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { isTypeSubTypeOf } from '../typeComparators';

describe('typeComparators', () => {
  describe('isTypeSubTypeOf', () => {
    function testSchema(fields: ObjMap<GraphQLFieldConfig<unknown, unknown>>) {
      return new GraphQLSchema({
        query: gqlObject({
          name: 'Query',
          fields,
        }),
      });
    }

    it('same reference is subtype', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLString, GraphQLString)).toEqual(
        true,
      );
    });

    it('int is not subtype of float', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLInt, GraphQLFloat)).toEqual(false);
    });

    it('non-null is subtype of nullable', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, new GraphQLNonNull(GraphQLInt), GraphQLInt),
      ).toEqual(true);
    });

    it('nullable is not subtype of non-null', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, new GraphQLNonNull(GraphQLInt)),
      ).toEqual(false);
    });

    it('item is not subtype of list', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, new GraphQLList(GraphQLInt)),
      ).toEqual(false);
    });

    it('list is not subtype of item', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, new GraphQLList(GraphQLInt), GraphQLInt),
      ).toEqual(false);
    });

    it('member is subtype of union', () => {
      const member = gqlObject({
        name: 'Object',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const union = gqlUnion({ name: 'Union', types: [member] });
      const schema = testSchema({ field: { type: union } });
      expect(isTypeSubTypeOf(schema, member, union)).toEqual(true);
    });
  });
});
