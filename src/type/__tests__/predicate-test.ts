import { DirectiveLocation } from '../../language/directiveLocation';

import type {
  GraphQLArgument,
  GraphQLInputType,
  IrisDataVariantField,
} from '../definition';
import {
  assertListType,
  assertNonNullType,
  getNamedType,
  getNullableType,
  GraphQLList,
  GraphQLNonNull,
  isDataType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isListType,
  isNamedType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isResolverType,
  isType,
  isUnionType,
  isWrappingType,
} from '../definition';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives';
import { gqlEnum, gqlInput, gqlObject, gqlScalar, gqlUnion } from '../make';
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
      expect(isType(new GraphQLNonNull(GraphQLString))).toEqual(true);
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
      expect(isObjectType(new GraphQLList(ObjectType))).toEqual(false);
    });
  });

  describe('isUnionType', () => {
    it('returns true for union type', () => {
      expect(isUnionType(UnionType)).toEqual(true);
    });

    it('returns false for non-union type', () => {
      expect(isUnionType(new GraphQLList(UnionType))).toEqual(false);
      expect(isUnionType(ObjectType)).toEqual(false);
    });
  });

  describe('isEnumType', () => {
    it('returns true for enum type', () => {
      expect(isEnumType(EnumType)).toEqual(true);
    });

    it('returns false for wrapped enum type', () => {
      expect(isEnumType(new GraphQLList(EnumType))).toEqual(false);
    });

    it('returns false for non-enum type', () => {
      expect(isEnumType(ScalarType)).toEqual(false);
    });
  });

  describe('isInputObjectType', () => {
    it('returns true for data  object type', () => {
      expect(isInputObjectType(InputObjectType)).toEqual(true);
    });

    it('returns false for wrapped data  object type', () => {
      expect(isInputObjectType(new GraphQLList(InputObjectType))).toEqual(
        false,
      );
    });

    it('returns false for non-input-object type', () => {
      expect(isInputObjectType(ObjectType)).toEqual(false);
    });
  });

  describe('isListType', () => {
    it('returns true for a list wrapped type', () => {
      expect(isListType(new GraphQLList(ObjectType))).toEqual(true);
      expect(() => assertListType(new GraphQLList(ObjectType))).not.toThrow();
    });

    it('returns false for an unwrapped type', () => {
      expect(isListType(ObjectType)).toEqual(false);
      expect(() => assertListType(ObjectType)).toThrow();
    });

    it('returns false for a non-list wrapped type', () => {
      expect(
        isListType(new GraphQLNonNull(new GraphQLList(ObjectType))),
      ).toEqual(false);
      expect(() =>
        assertListType(new GraphQLNonNull(new GraphQLList(ObjectType))),
      ).toThrow();
    });
  });

  describe('isNonNullType', () => {
    it('returns true for a non-null wrapped type', () => {
      expect(isNonNullType(new GraphQLNonNull(ObjectType))).toEqual(true);
      expect(() =>
        assertNonNullType(new GraphQLNonNull(ObjectType)),
      ).not.toThrow();
    });

    it('returns false for an unwrapped type', () => {
      expect(isNonNullType(ObjectType)).toEqual(false);
      expect(() => assertNonNullType(ObjectType)).toThrow();
    });

    it('returns false for a not non-null wrapped type', () => {
      expect(
        isNonNullType(new GraphQLList(new GraphQLNonNull(ObjectType))),
      ).toEqual(false);
      expect(() =>
        assertNonNullType(new GraphQLList(new GraphQLNonNull(ObjectType))),
      ).toThrow();
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
      expectInputType(new GraphQLList(GraphQLString));
      expectInputType(new GraphQLList(EnumType));
      expectInputType(new GraphQLList(InputObjectType));

      expectInputType(new GraphQLNonNull(GraphQLString));
      expectInputType(new GraphQLNonNull(EnumType));
      expectInputType(new GraphQLNonNull(InputObjectType));
    });

    function expectNonInputType(type: unknown) {
      expect(isInputType(type)).toEqual(false);
    }

    it('returns false for an output type', () => {
      expectNonInputType(ObjectType);
      expectNonInputType(UnionType);
    });

    it('returns false for a wrapped output type', () => {
      expectNonInputType(new GraphQLList(ObjectType));
      expectNonInputType(new GraphQLList(UnionType));

      expectNonInputType(new GraphQLNonNull(ObjectType));
      expectNonInputType(new GraphQLNonNull(UnionType));
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
      expectOutputType(new GraphQLList(GraphQLString));
      expectOutputType(new GraphQLList(ObjectType));
      expectOutputType(new GraphQLList(UnionType));
      expectOutputType(new GraphQLList(EnumType));
      expectOutputType(new GraphQLNonNull(GraphQLString));
      expectOutputType(new GraphQLNonNull(ObjectType));
      expectOutputType(new GraphQLNonNull(UnionType));
      expectOutputType(new GraphQLNonNull(EnumType));
    });
  });

  describe('isDataType', () => {
    it('returns true for scalar and enum types', () => {
      expect(isDataType(ScalarType)).toEqual(true);
      expect(isDataType(EnumType)).toEqual(true);
    });

    it('returns false for wrapped leaf type', () => {
      expect(isDataType(new GraphQLList(ScalarType))).toEqual(false);
    });

    it('returns false for non-leaf type', () => {
      expect(isDataType(ObjectType)).toEqual(false);
    });

    it('returns false for wrapped non-leaf type', () => {
      expect(isDataType(new GraphQLList(ObjectType))).toEqual(false);
    });
  });

  describe('isCompositeType', () => {
    it('returns true for object, interface, and union types', () => {
      expect(isResolverType(ObjectType)).toEqual(true);
      expect(isResolverType(UnionType)).toEqual(true);
    });

    it('returns false for wrapped composite type', () => {
      expect(isResolverType(new GraphQLList(ObjectType))).toEqual(false);
    });

    it('returns false for non-composite type', () => {
      expect(isResolverType(InputObjectType)).toEqual(false);
    });

    it('returns false for wrapped non-composite type', () => {
      expect(isResolverType(new GraphQLList(InputObjectType))).toEqual(false);
    });
  });

  describe('isWrappingType', () => {
    it('returns true for list and non-null types', () => {
      expect(isWrappingType(new GraphQLList(ObjectType))).toEqual(true);
      expect(isWrappingType(new GraphQLNonNull(ObjectType))).toEqual(true);
    });

    it('returns false for unwrapped types', () => {
      expect(isWrappingType(ObjectType)).toEqual(false);
    });
  });

  describe('isNullableType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNullableType(ObjectType)).toEqual(true);
    });

    it('returns true for list of non-null types', () => {
      expect(
        isNullableType(new GraphQLList(new GraphQLNonNull(ObjectType))),
      ).toEqual(true);
    });

    it('returns false for non-null types', () => {
      expect(isNullableType(new GraphQLNonNull(ObjectType))).toEqual(false);
    });
  });

  describe('getNullableType', () => {
    it('returns undefined for no type', () => {
      expect(getNullableType(undefined)).toEqual(undefined);
      expect(getNullableType(null)).toEqual(undefined);
    });

    it('returns self for a nullable type', () => {
      expect(getNullableType(ObjectType)).toEqual(ObjectType);
      const listOfObj = new GraphQLList(ObjectType);
      expect(getNullableType(listOfObj)).toEqual(listOfObj);
    });

    it('unwraps non-null type', () => {
      expect(getNullableType(new GraphQLNonNull(ObjectType))).toEqual(
        ObjectType,
      );
    });
  });

  describe('isNamedType', () => {
    it('returns true for unwrapped types', () => {
      expect(isNamedType(ObjectType)).toEqual(true);
    });

    it('returns false for list and non-null types', () => {
      expect(isNamedType(new GraphQLList(ObjectType))).toEqual(false);
      expect(isNamedType(new GraphQLNonNull(ObjectType))).toEqual(false);
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
      expect(getNamedType(new GraphQLNonNull(ObjectType))).toEqual(ObjectType);
      expect(getNamedType(new GraphQLList(ObjectType))).toEqual(ObjectType);
    });

    it('unwraps deeply wrapper types', () => {
      expect(
        getNamedType(
          new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ObjectType))),
        ),
      ).toEqual(ObjectType);
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
        type: new GraphQLNonNull(GraphQLString),
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
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      });
      expect(isRequiredArgument(optArg3)).toEqual(false);

      const optArg4 = buildArg({
        type: new GraphQLNonNull(GraphQLString),
        defaultValue: 'default',
      });
      expect(isRequiredArgument(optArg4)).toEqual(false);
    });
  });

  describe('isRequiredInputField', () => {
    function buildInputField(config: {
      type: GraphQLInputType;
    }): IrisDataVariantField {
      return {
        name: 'someInputField',
        type: config.type,
        description: undefined,
        deprecationReason: null,
        astNode: undefined,
      };
    }

    it('returns true for required data  field', () => {
      const requiredField = buildInputField({
        type: new GraphQLNonNull(GraphQLString),
      });
      expect(isRequiredInputField(requiredField)).toEqual(true);
    });

    it('returns false for optional data  field', () => {
      const optField1 = buildInputField({
        type: GraphQLString,
      });
      expect(isRequiredInputField(optField1)).toEqual(false);

      const optField2 = buildInputField({
        type: GraphQLString,
      });
      expect(isRequiredInputField(optField2)).toEqual(false);

      const optField3 = buildInputField({
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      });
      expect(isRequiredInputField(optField3)).toEqual(false);
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
