import { DirectiveLocation } from '../../language/directiveLocation';

import type {
  GraphQLArgument,
  GraphQLInputField,
  GraphQLInputType,
} from '../definition';
import {
  assertAbstractType,
  assertLeafType,
  assertListType,
  assertNonNullType,
  assertObjectType,
  assertScalarType,
  getNamedType,
  getNullableType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  isAbstractType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isLeafType,
  isListType,
  isNamedType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isResolverType,
  isScalarType,
  isType,
  isUnionType,
  isWrappingType,
} from '../definition';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives';
import { gqlEnum, gqlInput, gqlObject, gqlUnion } from '../make';
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
const ScalarType = new GraphQLScalarType({ name: 'Scalar' });
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

  describe('isScalarType', () => {
    it('returns true for spec defined scalar', () => {
      expect(isScalarType(GraphQLString)).toEqual(true);
      expect(() => assertScalarType(GraphQLString)).not.toThrow();
    });

    it('returns true for custom scalar', () => {
      expect(isScalarType(ScalarType)).toEqual(true);
      expect(() => assertScalarType(ScalarType)).not.toThrow();
    });

    it('returns false for scalar class (rather than instance)', () => {
      expect(isScalarType(GraphQLScalarType)).toEqual(false);
      expect(() => assertScalarType(GraphQLScalarType)).toThrow();
    });

    it('returns false for wrapped scalar', () => {
      expect(isScalarType(new GraphQLList(ScalarType))).toEqual(false);
      expect(() => assertScalarType(new GraphQLList(ScalarType))).toThrow();
    });

    it('returns false for non-scalar', () => {
      expect(isScalarType(EnumType)).toEqual(false);
      expect(() => assertScalarType(EnumType)).toThrow();
      expect(isScalarType(Directive)).toEqual(false);
      expect(() => assertScalarType(Directive)).toThrow();
    });

    it('returns false for random garbage', () => {
      expect(isScalarType({ what: 'is this' })).toEqual(false);
      expect(() => assertScalarType({ what: 'is this' })).toThrow();
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
      expect(() => assertObjectType(ObjectType)).not.toThrow();
    });

    it('returns false for wrapped object type', () => {
      expect(isObjectType(new GraphQLList(ObjectType))).toEqual(false);
      expect(() => assertObjectType(new GraphQLList(ObjectType))).toThrow();
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

    function expectNonOutputType(type: unknown) {
      expect(isOutputType(type)).toEqual(false);
    }

    it('returns false for an data  type', () => {
      expectNonOutputType(InputObjectType);
    });

    it('returns false for a wrapped data  type', () => {
      expectNonOutputType(new GraphQLList(InputObjectType));
      expectNonOutputType(new GraphQLNonNull(InputObjectType));
    });
  });

  describe('isLeafType', () => {
    it('returns true for scalar and enum types', () => {
      expect(isLeafType(ScalarType)).toEqual(true);
      expect(() => assertLeafType(ScalarType)).not.toThrow();
      expect(isLeafType(EnumType)).toEqual(true);
      expect(() => assertLeafType(EnumType)).not.toThrow();
    });

    it('returns false for wrapped leaf type', () => {
      expect(isLeafType(new GraphQLList(ScalarType))).toEqual(false);
      expect(() => assertLeafType(new GraphQLList(ScalarType))).toThrow();
    });

    it('returns false for non-leaf type', () => {
      expect(isLeafType(ObjectType)).toEqual(false);
      expect(() => assertLeafType(ObjectType)).toThrow();
    });

    it('returns false for wrapped non-leaf type', () => {
      expect(isLeafType(new GraphQLList(ObjectType))).toEqual(false);
      expect(() => assertLeafType(new GraphQLList(ObjectType))).toThrow();
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

  describe('isAbstractType', () => {
    it('returns true for interface and union types', () => {
      expect(isAbstractType(UnionType)).toEqual(true);
      expect(() => assertAbstractType(UnionType)).not.toThrow();
    });

    it('returns false for non-abstract type', () => {
      expect(isAbstractType(ObjectType)).toEqual(false);
      expect(() => assertAbstractType(ObjectType)).toThrow();
    });

    it('returns false for wrapped non-abstract type', () => {
      expect(isAbstractType(new GraphQLList(ObjectType))).toEqual(false);
      expect(() => assertAbstractType(new GraphQLList(ObjectType))).toThrow();
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
    }): GraphQLInputField {
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
    it('returns true for spec defined directive', () => {
      expect(isDirective(GraphQLSkipDirective)).toEqual(true);
      expect(() => assertDirective(GraphQLSkipDirective)).not.toThrow();
    });

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
      expect(isSpecifiedDirective(GraphQLIncludeDirective)).toEqual(true);
      expect(isSpecifiedDirective(GraphQLSkipDirective)).toEqual(true);
      expect(isSpecifiedDirective(GraphQLDeprecatedDirective)).toEqual(true);
    });

    it('returns false for custom directive', () => {
      expect(isSpecifiedDirective(Directive)).toEqual(false);
    });
  });
});
