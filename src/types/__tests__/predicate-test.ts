import { all } from 'ramda';

import { sampleTypeRef } from '../../utils/generators';

import type {
  IrisArgument,
  IrisTypeDefinition,
  IrisTypeRef,
} from '../definition';
import {
  IrisScalars,
  isRequiredArgument,
  isSpecifiedScalarType,
} from '../definition';
import { IrisDirectiveLocation } from '../directiveLocation';
import {
  assertDirective,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  isDirective,
  isSpecifiedDirective,
} from '../directives';
import { buildSchema, getType } from '../schema';

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

const EnumType = getType(schema, 'Enum');

const ScalarType = getType(schema, 'Scalar');
const Directive = new GraphQLDirective({
  name: 'Directive',
  locations: [IrisDirectiveLocation.QUERY],
});

describe('Type predicates', () => {
  describe('isSpecifiedScalarType', () => {
    it('returns true for specified scalars', () => {
      expect(all(isSpecifiedScalarType, Object.values(IrisScalars))).toBe(true);
    });

    it('returns false for custom scalar', () => {
      expect(
        isSpecifiedScalarType(ScalarType as IrisTypeDefinition<'data'>),
      ).toEqual(false);
    });
  });

  describe('isRequiredArgument', () => {
    function buildArg(config: {
      type: IrisTypeRef<'data'>;
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
