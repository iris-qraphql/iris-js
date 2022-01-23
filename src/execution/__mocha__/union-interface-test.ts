import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { GraphQLList, GraphQLObjectType } from '../../type/definition';
import { gqlObject, gqlUnion } from '../../type/make';
import { GraphQLBoolean, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { executeSync } from '../execute';

class Dog {
  name: string;
  barks: boolean;
  mother?: Dog;
  father?: Dog;
  progeny: ReadonlyArray<Dog>;

  constructor(name: string, barks: boolean) {
    this.name = name;
    this.barks = barks;
    this.progeny = [];
  }
}

class Cat {
  name: string;
  meows: boolean;
  mother?: Cat;
  father?: Cat;
  progeny: ReadonlyArray<Cat>;

  constructor(name: string, meows: boolean) {
    this.name = name;
    this.meows = meows;
    this.progeny = [];
  }
}

class Person {
  name: string;
  pets?: ReadonlyArray<Dog | Cat>;
  friends?: ReadonlyArray<Dog | Cat | Person>;

  constructor(
    name: string,
    pets?: ReadonlyArray<Dog | Cat>,
    friends?: ReadonlyArray<Dog | Cat | Person>,
  ) {
    this.name = name;
    this.pets = pets;
    this.friends = friends;
  }
}

const DogType: GraphQLObjectType = gqlObject({
  name: 'Dog',
  fields: () => ({
    name: { type: GraphQLString },
    barks: { type: GraphQLBoolean },
    progeny: { type: new GraphQLList(DogType) },
    mother: { type: DogType },
    father: { type: DogType },
  }),
  isTypeOf: (value) => value instanceof Dog,
});

const CatType: GraphQLObjectType = gqlObject({
  name: 'Cat',
  fields: () => ({
    name: { type: GraphQLString },
    meows: { type: GraphQLBoolean },
    progeny: { type: new GraphQLList(CatType) },
    mother: { type: CatType },
    father: { type: CatType },
  }),
  isTypeOf: (value) => value instanceof Cat,
});

const PetType = gqlUnion({
  name: 'Pet',
  types: [DogType, CatType],
  resolveType(value) {
    if (value instanceof Dog) {
      return DogType.name;
    }
    if (value instanceof Cat) {
      return CatType.name;
    }
    /* c8 ignore next 3 */
    // Not reachable, all possible types have been considered.
    expect.fail('Not reachable');
  },
});

const PersonType: GraphQLObjectType = gqlObject({
  name: 'Person',
  fields: () => ({
    name: { type: GraphQLString },
    pets: { type: new GraphQLList(PetType) },
    progeny: { type: new GraphQLList(PersonType) },
    mother: { type: PersonType },
    father: { type: PersonType },
  }),
  isTypeOf: (value) => value instanceof Person,
});

const schema = new GraphQLSchema({
  query: PersonType,
  types: [PetType],
});

const garfield = new Cat('Garfield', false);
garfield.mother = new Cat("Garfield's Mom", false);
garfield.mother.progeny = [garfield];

const odie = new Dog('Odie', true);
odie.mother = new Dog("Odie's Mom", true);
odie.mother.progeny = [odie];

const liz = new Person('Liz');
const john = new Person('John', [garfield, odie], [liz, odie]);

describe('Execute: Union and intersection types', () => {
  it('executes using unions', () => {
    // NOTE: This is an *invalid* query, but it should be an *executable* query.
    const document = parse(`
      {
        __typename
        name
        pets {
          __typename
          name
          barks
          meows
        }
      }
    `);

    expect(executeSync({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        pets: [
          {
            __typename: 'Cat',
            name: 'Garfield',
            meows: false,
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
          },
        ],
      },
    });
  });

  it('executes unions with inline fragments', () => {
    // This is the valid version of the query in the above test.
    const document = parse(`
      {
        __typename
        name
        pets {
          __typename
          ... on Dog {
            name
            barks
          }
          ... on Cat {
            name
            meows
          }
        }
      }
    `);

    expect(executeSync({ schema, document, rootValue: john })).to.deep.equal({
      data: {
        __typename: 'Person',
        name: 'John',
        pets: [
          {
            __typename: 'Cat',
            name: 'Garfield',
            meows: false,
          },
          {
            __typename: 'Dog',
            name: 'Odie',
            barks: true,
          },
        ],
      },
    });
  });
});
