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

resolver God = {
    name: String
    lifespan: Lifespan
  }

resolver Deity
  = God
  | Titan { name: String }

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
    lifespan: () => ({ __typename: 'Limited', max: 200 }),
  },
};

const server = new ApolloServer({ schema: irisSchema(typeDefs, resolvers) });
server.listen().then(({ url }) => console.log(`🚀  Server ready at ${url}`));
