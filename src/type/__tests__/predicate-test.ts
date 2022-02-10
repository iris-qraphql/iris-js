import { all } from 'ramda';

import { DirectiveLocation } from '../../language/directiveLocation';

import type { IrisArgument, IrisStrictType, IrisType } from '../definition';
import {
  assertDataType,
  assertResolverType,
  isDataType,
  isInputType,
  isListType,
  isObjectType,
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
import { sampleTypeRef, withWrappers } from '../make';
import { IrisScalars, isSpecifiedScalarType } from '../scalars';
import { buildSchema } from '../schema';

const definitions = `
  data Scalar = Int

  data Enum = foo{}

  data InputObject = {}

  resolver Object = {}

  resolver Union = Object
`;

const schema = buildSchema(`
  ${definitions}

  resolver Query = {
    object: Object
    union: Union
    string: String
  }
`);

const ObjectType = assertResolverType(schema.getType('Object'));
const EnumType = assertDataType(schema.getType('Enum'));

const ScalarType = assertDataType(schema.getType('Scalar'));
const Directive = new GraphQLDirective({
  name: 'Directive',
  locations: [DirectiveLocation.QUERY],
});

const dataTypes = ['String', 'Enum', 'InputObject'];
const resolverTypes = ['Object', 'Union'];

const typeRef = (exp: string) => sampleTypeRef(exp, definitions);

const check = (f: (_: IrisType) => boolean, exp: string) =>
  expect(f(typeRef(exp)));

const tautology = (f: (_: IrisType) => boolean, exp: string): void =>
  expect(f(typeRef(exp))).toEqual(true);

describe('Type predicates', () => {
  describe('isType', () => {
    it('returns true for unwrapped types', () => {
      tautology(isType, 'String');
      tautology(isType, 'Object');
    });

    it('returns true for wrapped types', () => {
      tautology(isType, '[String]');
      tautology(isType, 'String?');
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
      check(isObjectType, 'Object').toEqual(true);
    });

    it('returns false for wrapped object type', () => {
      check(isObjectType, '[Object]').toEqual(false);
    });
  });

  describe('isListType', () => {
    it('returns true for a list wrapped type', () => {
      tautology(isListType, '[Object]');
    });

    it('returns false for an unwrapped type', () => {
      check(isListType, 'Object').toBe(false);
    });

    it('returns false for a non-list wrapped type', () => {
      expect(isListType(sampleTypeRef('[Boolean]?'))).toEqual(false);
    });
  });

  describe('isInputType', () => {
    it('returns true for an data  type', () => {
      for (const type of dataTypes.flatMap(withWrappers)) {
        tautology(isInputType, type);
      }
    });

    it('returns false for an output type', () => {
      for (const type of resolverTypes.flatMap(withWrappers)) {
        check(isInputType, type).toBe(false);
      }
    });
  });

  describe('isDataType', () => {
    it('returns true for scalar and enum types', () => {
      expect(isDataType(ScalarType)).toEqual(true);
      expect(isDataType(EnumType)).toEqual(true);
    });

    it('returns false for wrapped leaf type', () => {
      check(isDataType, '[Scalar]').toBe(false);
    });

    it('returns false for non-leaf type', () => {
      check(isDataType, 'Object').toEqual(false);
      check(isDataType, '[Object]').toEqual(false);
    });
  });

  describe('isCompositeType', () => {
    it('returns true for resolver types', () => {
      for (const type of resolverTypes) {
        check(isResolverType, type).toBe(true);
      }
    });

    it('returns false for wrapped composite type', () => {
      check(isResolverType, '[Object]').toBe(false);
    });

    it('returns false for non-composite type', () => {
      check(isResolverType, 'InputObject').toBe(false);
    });

    it('returns false for wrapped non-composite type', () => {
      check(isResolverType, '[InputObject]').toBe(false);
    });
  });

  describe('isWrappingType', () => {
    it('returns true for list and maybe types', () => {
      tautology(isTypeRef, '[Object]');
      tautology(isTypeRef, 'Object?');
    });

    it('returns false for unwrapped types', () => {
      expect(isTypeRef(ObjectType)).toEqual(false);
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
        type: sampleTypeRef('String'),
      });
      expect(isRequiredArgument(requiredArg)).toEqual(true);
    });

    it('returns false for optional arguments', () => {
      const optArg1 = buildArg({
        type: sampleTypeRef<'data'>('String?'),
      });
      expect(isRequiredArgument(optArg1)).toEqual(false);

      const optArg2 = buildArg({
        type: sampleTypeRef<'data'>('String?'),
        defaultValue: null,
      });
      expect(isRequiredArgument(optArg2)).toEqual(false);

      const optArg3 = buildArg({
        type: sampleTypeRef<'data'>('[String]?'),
      });
      expect(isRequiredArgument(optArg3)).toEqual(false);

      const optArg4 = buildArg({
        type: sampleTypeRef<'data'>('String?'),
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
