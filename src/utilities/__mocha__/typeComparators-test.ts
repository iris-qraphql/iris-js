import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { GraphQLFieldConfigMap } from '../../type/definition';
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  IrisResolverType,
} from '../../type/definition';
import { GraphQLFloat, GraphQLInt, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { isEqualType, isTypeSubTypeOf } from '../typeComparators';

describe('typeComparators', () => {
  describe('isEqualType', () => {
    it('same reference are equal', () => {
      expect(isEqualType(GraphQLString, GraphQLString)).to.equal(true);
    });

    it('int and float are not equal', () => {
      expect(isEqualType(GraphQLInt, GraphQLFloat)).to.equal(false);
    });

    it('lists of same type are equal', () => {
      expect(
        isEqualType(new GraphQLList(GraphQLInt), new GraphQLList(GraphQLInt)),
      ).to.equal(true);
    });

    it('lists is not equal to item', () => {
      expect(isEqualType(new GraphQLList(GraphQLInt), GraphQLInt)).to.equal(
        false,
      );
    });

    it('non-null of same type are equal', () => {
      expect(
        isEqualType(
          new GraphQLNonNull(GraphQLInt),
          new GraphQLNonNull(GraphQLInt),
        ),
      ).to.equal(true);
    });

    it('non-null is not equal to nullable', () => {
      expect(isEqualType(new GraphQLNonNull(GraphQLInt), GraphQLInt)).to.equal(
        false,
      );
    });
  });

  describe('isTypeSubTypeOf', () => {
    function testSchema(fields: GraphQLFieldConfigMap<unknown, unknown>) {
      return new GraphQLSchema({
        query: gqlObject({
          name: 'Query',
          fields,
        }),
      });
    }

    it('same reference is subtype', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLString, GraphQLString)).to.equal(
        true,
      );
    });

    it('int is not subtype of float', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLInt, GraphQLFloat)).to.equal(false);
    });

    it('non-null is subtype of nullable', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, new GraphQLNonNull(GraphQLInt), GraphQLInt),
      ).to.equal(true);
    });

    it('nullable is not subtype of non-null', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, new GraphQLNonNull(GraphQLInt)),
      ).to.equal(false);
    });

    it('item is not subtype of list', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, new GraphQLList(GraphQLInt)),
      ).to.equal(false);
    });

    it('list is not subtype of item', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, new GraphQLList(GraphQLInt), GraphQLInt),
      ).to.equal(false);
    });

    it('member is subtype of union', () => {
      const member = gqlObject({
        name: 'Object',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const union = new IrisResolverType({ name: 'Union', types: [member] });
      const schema = testSchema({ field: { type: union } });
      expect(isTypeSubTypeOf(schema, member, union)).to.equal(true);
    });
  });
});
