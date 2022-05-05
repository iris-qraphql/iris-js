// eslint-disable-next-line strict
const { ApolloServer } = require('apollo-server');

// eslint-disable-next-line node/no-unpublished-require
const { irisSchema } = require('./dist/index.js');

const typeDefs = `
"""
lifespan of deity
"""
data Lifespan
  = Immortal {}
  | Limited { max: Int? }

"""
Third and fourth generation of the deity in Greek mythology, 
also called Olympians.
"""
resolver God = {
    name: String
    lifespan: Lifespan
  }

"""
A supernatural being considered divine and sacred
"""
resolver Deity
  = God
  | """
    second generation of the deity in Greek mythology
    """
    Titan { name: String }

resolver Query = {
    deities(lifespan: Lifespan?): [Deity]
  }
`;

const resolvers = {
  Query: {
    deities: () => [
      {
        name: 'Iris',
        age: 12,
        __typename: 'God',
      },
      {
        name: 'Zeus',
        __typename: 'Deity_Titan',
      },
    ],
  },
  God: {
    lifespan: () => ({
      __typename: 'Limited',
      max: 200,
    }),
  },
};
const schema = irisSchema({ typeDefs, resolvers });
const server = new ApolloServer({ schema });
server.listen().then(({ url }) => console.log(`🚀  Server ready at ${url}`));
