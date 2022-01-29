import { DirectiveLocation } from '../../language/directiveLocation';

import type { GraphQLArgument, GraphQLInputType } from '../definition';
import {
  getNamedType,
  getNullableType,
  isDataType,
  isInputType,
  isListType,
  isNonNullType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isResolverType,
  isType,
  isTypeRef,
} from '../definition';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives';
import {
  gqlEnum,
  gqlInput,
  gqlList,
  gqlNonNull,
  gqlObject,
  gqlScalar,
  gqlUnion,
} from '../make';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  isSpecifiedScalarType,
} from '../scalars';

const ObjectType = gqlObject({ name: 'Object', fields: {} });
const UnionType = gqlUnion({ name: 'Union', types: [ObjectType] });
const EnumType = gqlEnum('Enum', ['foo']);
const InputObjectType = gqlInput({
  name: 'InputObject',
  fields: {},
});
const ScalarType = gqlScalar({ name: 'Scalar' });
const Directive = new GraphQLDirective({
  name: 'Directive',
  locations: [DirectiveLocation.QUERY],
});

describe('Type predicates', () => {
  describe('isType', () => {
    it('returns true for unwrapped types', () => {
      expect(isType(GraphQLString)).toEqual(true);
      expect(isType(ObjectType)).toEqual(true);
    });

    it('returns true for wrapped types', () => {
      expect(isType(gqlNonNull(GraphQLString))).toEqual(true);
    });

    it('returns false for random garbage', () => {
      expect(isType({ what: 'is this' })).toEqual(false);
    });
  });

  describe('isSpecifiedScalarType', () => {
    it('returns true for specified scalars', () => {
      expect(isSpecifiedScalarType(GraphQLString)).toEqual(true);
      expect(isSpecifiedScalarType(GraphQLInt)).toEqual(true);
      expect(isSpecifiedScalarType(GraphQLFloat)).toEqual(true);
      expect(isSpecifiedScalarType(GraphQLBoolean)).toEqual(true);
      expect(isSpecifiedScalarType(GraphQLID)).toEqual(true);
    });

    it('returns false for custom scalar', () => {
      expect(isSpecifiedScalarType(ScalarType)).toEqual(false);
    });
  });

  describe('isObjectType', () => {
    it('returns true for object type', () => {
      expect(isObjectType(ObjectType)).toEqual(true);
    });

    it('returns false for wrapped object type', () => {
      expect(isObjectType(gqlList(ObjectType))).toEqual(false);
    });
  });

  describe('isListType', () => {
    it('returns true for a list wrapped type', () => {
      expect(isListType(gqlList(ObjectType))).toEqual(true);
    });

    it('returns false for an unwrapped type', () => {
      expect(isListType(ObjectType)).toEqual(false);
    });

    it('returns false for a non-list wrapped type', () => {
      expect(isListType(gqlNonNull(gqlList(ObjectType)))).toEqual(false);
    });
  });

  describe('isNonNullType', () => {
    it('returns true for a non-null wrapped type', () => {
      expect(isNonNullType(gqlNonNull(ObjectType))).toEqual(true);
    });

    it('returns false for an unwrapped type', () => {
      expect(isNonNullType(ObjectType)).toEqual(false);
    });

    it('returns false for a not non-null wrapped type', () => {
      expect(isNonNullType(gqlList(gqlNonNull(ObjectType)))).toEqual(false);
    });
  });

  describe('isInputType', () => {
    function expectInputType(type: unknown) {
      expect(isInputType(type)).toEqual(true);
    }

    it('returns true for an data  type', () => {
      expectInputType(GraphQLString);
      expectInputType(EnumType);
      expectInputType(InputObjectType);
    });

    it('returns true for a wrapped data  type', () => {
      expectInputType(gqlList(GraphQLString));
      expectInputType(gqlList(EnumType));
      expectInputType(gqlList(InputObjectType));

      expectInputType(gqlNonNull(GraphQLString));
      expectInputType(gqlNonNull(EnumType));
      expectInputType(gqlNonNull(InputObjectType));
    });

    function expectNonInputType(type: unknown) {
      expect(isInputType(type)).toEqual(false);
    }

    it('returns false for an output type', () => {
      expectNonInputType(ObjectType);
      expectNonInputType(UnionType);
    });

    it('returns false for a wrapped output type', () => {
      expectNonInputType(gqlList(ObjectType));
      expectNonInputType(gqlList(UnionType));

      expectNonInputType(gqlNonNull(ObjectType));
      expectNonInputType(gqlNonNull(UnionType));
    });
  });

  describe('isOutputType', () => {
    function expectOutputType(type: unknown) {
      expect(isOutputType(type)).toEqual(true);
    }

    it('returns true for an output type', () => {
      expectOutputType(GraphQLString);
      expectOutputType(ObjectType);
      expectOutputType(UnionType);
      expectOutputType(EnumType);
    });

    it('returns true for a wrapped output type', () => {
      expectOutputType(gqlList(GraphQLString));
      expectOutputType(gqlList(ObjectType));
      expectOutputType(gqlList(UnionType));
      expectOutputType(gqlList(EnumType));
      expectOutputType(gqlNonNull(GraphQLString));
      expectOutputType(gqlNonNull(ObjectType));
      expectOutputType(gqlNonNull(UnionType));
      expectOutputType(gqlNonNull(EnumType));
    });
  });

  describe('isDataType', () => {
    it('returns true for scalar and enum types', () => {
      expect(isDataType(ScalarType)).toEqual(true);
      expect(isDataType(EnumType)).toEqual(true);
    });

    it('returns false for wrapped leaf type', () => {
      expect(isDataType(gqlList(ScalarType))).toEqual(false);
    });

    it('returns false for non-leaf type', () => {
      expect(isDataType(ObjectType)).toEqual(false);
    });

    it('returns false for wrapped non-leaf type', () => {
      expect(isDataType(gqlList(ObjectType))).toEqual(false);
    });
  });

  describe('isCompositeType', () => {
    it('returns true for object, interface, and union types', () => {
      expect(isResolverType(ObjectType)).toEqual(true);
      expect(isResolverType(UnionType)).toEqual(true);
    });

    it('returns false for wrapped composite type', () => {
      expect(isResolverType(gqlList(ObjectType))).toEqual(false);
    });

    it('returns false for non-composite type', () => {
      expect(isResolverType(InputObjectType)).toEqual(false);
    });

    it('returns false for wrapped non-composite type', () => {
      expect(isResolverType(gqlList(InputObjectType))).toEqual(false);
    });
  });

  describe('isWrappingType', () => {
    it('returns true for list and non-null types', () => {
      expect(isTypeRef(gqlList(ObjectType))).toEqual(true);
      expect(isTypeRef(gqlNonNull(ObjectType))).toEqual(true);
    });

    it('returns false for unwrapped types', () => {
      expect(isTypeRef(ObjectType)).toEqual(false);
    });
  });

  describe('isNullableType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNonNullType(ObjectType)).toEqual(false);
    });

    it('returns true for list of non-null types', () => {
      expect(isNonNullType(gqlList(gqlNonNull(ObjectType)))).toEqual(false);
    });

    it('returns false for non-null types', () => {
      expect(isNonNullType(gqlNonNull(ObjectType))).toEqual(true);
    });
  });

  describe('getNullableType', () => {
    it('returns undefined for no type', () => {
      expect(getNullableType(undefined)).toEqual(undefined);
      expect(getNullableType(null)).toEqual(undefined);
    });

    it('returns self for a nullable type', () => {
      expect(getNullableType(ObjectType)).toEqual(ObjectType);
      const listOfObj = gqlList(ObjectType);
      expect(getNullableType(listOfObj)).toEqual(listOfObj);
    });

    it('unwraps non-null type', () => {
      expect(getNullableType(gqlNonNull(ObjectType))).toEqual(ObjectType);
    });
  });

  describe('getNamedType', () => {
    it('returns undefined for no type', () => {
      expect(getNamedType(undefined)).toEqual(undefined);
      expect(getNamedType(null)).toEqual(undefined);
    });

    it('returns self for a unwrapped type', () => {
      expect(getNamedType(ObjectType)).toEqual(ObjectType);
    });

    it('unwraps wrapper types', () => {
      expect(getNamedType(gqlNonNull(ObjectType))).toEqual(ObjectType);
      expect(getNamedType(gqlList(ObjectType))).toEqual(ObjectType);
    });

    it('unwraps deeply wrapper types', () => {
      expect(getNamedType(gqlNonNull(gqlList(gqlNonNull(ObjectType))))).toEqual(
        ObjectType,
      );
    });
  });

  describe('isRequiredArgument', () => {
    function buildArg(config: {
      type: GraphQLInputType;
      defaultValue?: unknown;
    }): GraphQLArgument {
      return {
        name: 'someArg',
        type: config.type,
        description: undefined,
        defaultValue: config.defaultValue,
        deprecationReason: null,
        astNode: undefined,
      };
    }

    it('returns true for required arguments', () => {
      const requiredArg = buildArg({
        type: gqlNonNull(GraphQLString),
      });
      expect(isRequiredArgument(requiredArg)).toEqual(true);
    });

    it('returns false for optional arguments', () => {
      const optArg1 = buildArg({
        type: GraphQLString,
      });
      expect(isRequiredArgument(optArg1)).toEqual(false);

      const optArg2 = buildArg({
        type: GraphQLString,
        defaultValue: null,
      });
      expect(isRequiredArgument(optArg2)).toEqual(false);

      const optArg3 = buildArg({
        type: gqlList(gqlNonNull(GraphQLString)),
      });
      expect(isRequiredArgument(optArg3)).toEqual(false);

      const optArg4 = buildArg({
        type: gqlNonNull(GraphQLString),
        defaultValue: 'default',
      });
      expect(isRequiredArgument(optArg4)).toEqual(false);
    });
  });
});

describe('Directive predicates', () => {
  describe('isDirective', () => {
    it('returns true for custom directive', () => {
      expect(isDirective(Directive)).toEqual(true);
      expect(() => assertDirective(Directive)).not.toThrow();
    });

    it('returns false for directive class (rather than instance)', () => {
      expect(isDirective(GraphQLDirective)).toEqual(false);
      expect(() => assertDirective(GraphQLDirective)).toThrow();
    });

    it('returns false for non-directive', () => {
      expect(isDirective(EnumType)).toEqual(false);
      expect(() => assertDirective(EnumType)).toThrow();
      expect(isDirective(ScalarType)).toEqual(false);
      expect(() => assertDirective(ScalarType)).toThrow();
    });

    it('returns false for random garbage', () => {
      expect(isDirective({ what: 'is this' })).toEqual(false);
      expect(() => assertDirective({ what: 'is this' })).toThrow();
    });
  });
  describe('isSpecifiedDirective', () => {
    it('returns true for specified directives', () => {
      expect(isSpecifiedDirective(GraphQLDeprecatedDirective)).toEqual(true);
    });

    it('returns false for custom directive', () => {
      expect(isSpecifiedDirective(Directive)).toEqual(false);
    });
  });
});
