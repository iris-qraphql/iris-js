import { all } from 'ramda';

import { DirectiveLocation } from '../../language/directiveLocation';

import type { IrisArgument, IrisStrictType } from '../definition';
import {
  assertDataType,
  assertResolverType,
  getNamedType,
  isDataType,
  isInputType,
  isListType,
  isObjectType,
  isRequiredArgument,
  isResolverType,
  isType,
  isTypeRef,
  unpackMaybe,
} from '../definition';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives';
import { gqlList, maybe, sampleTypeRef } from '../make';
import { IrisScalars, isSpecifiedScalarType } from '../scalars';
import { buildSchema } from '../schema';

const schema = buildSchema(`
  data Scalar = Int

  data Enum = foo{}

  data InputObject = {}

  resolver Object = {}

  resolver Union = Object

  resolver Query = {
    object: Object
    union: Union
    string: String
  }
`);

const ObjectType = assertResolverType(schema.getType('Object'));
const UnionType = assertResolverType(schema.getType('Union'));
const EnumType = assertDataType(schema.getType('Enum'));
const InputObjectType = assertDataType(schema.getType('InputObject'));
const ScalarType = assertDataType(schema.getType('Scalar'));
const Directive = new GraphQLDirective({
  name: 'Directive',
  locations: [DirectiveLocation.QUERY],
});
const IrisString = IrisScalars.String;

describe('Type predicates', () => {
  describe('isType', () => {
    it('returns true for unwrapped types', () => {
      expect(isType(IrisString)).toEqual(true);
      expect(isType(ObjectType)).toEqual(true);
    });

    it('returns true for wrapped types', () => {
      expect(isType(sampleTypeRef('[String]'))).toEqual(true);
      expect(isType(sampleTypeRef('String?'))).toEqual(true);
    });

    it('returns false for random garbage', () => {
      expect(isType({ what: 'is this' })).toEqual(false);
    });
  });

  describe('isSpecifiedScalarType', () => {
    it('returns true for specified scalars', () => {
      expect(all(isSpecifiedScalarType, Object.values(IrisScalars))).toBe(true);
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
      expect(isListType(maybe(gqlList(ObjectType)))).toEqual(false);
    });
  });

  describe('isInputType', () => {
    function expectInputType(type: unknown) {
      expect(isInputType(type)).toEqual(true);
    }

    it('returns true for an data  type', () => {
      expectInputType(IrisString);
      expectInputType(EnumType);
      expectInputType(InputObjectType);
    });

    it('returns true for a wrapped data  type', () => {
      expectInputType(gqlList(IrisString));
      expectInputType(gqlList(EnumType));
      expectInputType(gqlList(InputObjectType));

      expectInputType(maybe(IrisString));
      expectInputType(maybe(EnumType));
      expectInputType(maybe(InputObjectType));
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

      expectNonInputType(maybe(ObjectType));
      expectNonInputType(maybe(UnionType));
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
    it('returns true for list and maybe types', () => {
      expect(isTypeRef(gqlList(ObjectType))).toEqual(true);
      expect(isTypeRef(maybe(ObjectType))).toEqual(true);
    });

    it('returns false for unwrapped types', () => {
      expect(isTypeRef(ObjectType)).toEqual(false);
    });
  });

  describe('unpackMaybe', () => {
    it('returns undefined for no type', () => {
      expect(unpackMaybe(undefined)).toEqual(undefined);
      expect(unpackMaybe(null)).toEqual(undefined);
    });

    it('unwraps maybe type', () => {
      expect(unpackMaybe(maybe(ObjectType))).toEqual(ObjectType);
      const listOfObj = gqlList(ObjectType);
      expect(unpackMaybe(maybe(listOfObj))).toEqual(listOfObj);
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
      expect(getNamedType(ObjectType)).toEqual(ObjectType);
      expect(getNamedType(gqlList(ObjectType))).toEqual(ObjectType);
    });

    it('unwraps deeply wrapper types', () => {
      expect(getNamedType(gqlList(ObjectType))).toEqual(ObjectType);
    });
  });

  describe('isRequiredArgument', () => {
    function buildArg(config: {
      type: IrisStrictType;
      defaultValue?: unknown;
    }): IrisArgument {
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
        type: IrisString,
      });
      expect(isRequiredArgument(requiredArg)).toEqual(true);
    });

    it('returns false for optional arguments', () => {
      const maybeString = maybe(IrisString);
      const optArg1 = buildArg({
        type: maybeString,
      });
      expect(isRequiredArgument(optArg1)).toEqual(false);

      const optArg2 = buildArg({
        type: maybeString,
        defaultValue: null,
      });
      expect(isRequiredArgument(optArg2)).toEqual(false);

      const optArg3 = buildArg({
        type: maybe(gqlList(maybeString)),
      });
      expect(isRequiredArgument(optArg3)).toEqual(false);

      const optArg4 = buildArg({
        type: IrisString,
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
