# Iris.js

The JavaScript implementation for Iris

## What is Iris?

## Why Iris ?

problems with GraphQL.

- GraphQL is not good much for server to server applications where you need no selectivity such as RPC like scenarios.
- Graphql is can't sufficiently handle recursive data types
- does not support input unions
- we are forced to define input/output types and have multiple entities with complex rules for defining ADT like types.
- default values GraphQL inputs are  risky on recursive data types.

Iris solutions.

- default values in iris are only allowed on arguments
- iris uses only 3 entities `wrapping`, `data` and `resolver` types. where `data` and `resolver` are represented with identical `ADT` syntax.
- Iris can handle recursive data types with `data` entity, which can also be used as input unions.
- in Iris you can use `data` types with query definition to achieve RPC like api definitions, where selectivity is not the key demand.

## Getting Started

### Using Iris.js

Install Iris.js

With npm:

```sh
npm install --save iris
```

iris.js enables to build enhanced GraphQL schema by iris syntax

```js
import { ApolloServer } from 'apollo-server'
import { irisSchema } from 'iris';

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



const schema = irisSchema(typeDefs, resolvers);
````

schema defined above can be used by regular GraphQL server (for example we use apollo server).

```ts
const server = new ApolloServer({ schema });

server
  .listen()
  .then(({ url }) => console.log(`🚀  Server ready at ${url}`));
```

GraphQL server is running on: <http://localhost:4000>.

where client will see following GraphQL schema definition.

```graphql
"""
lifespan of deity

@typedef {{ __typename: "Limited", max: ?Int }} Lifespan_Limited
@type {("Immortal" | Lifespan_Limited)}
"""
scalar Lifespan

"""
Third and fourth generation of the deity in Greek mythology, 
also called Olympians.
"""
type God {
  name: String!
  lifespan: Lifespan!
}

"""A supernatural being considered divine and sacred"""
union Deity = God | Deity_Titan

"""second generation of the deity in Greek mythology"""
type Deity_Titan {
  name: String!
}

type Query {
  deities(lifespan: Lifespan): [Deity!]!
}
```

as we can see type `Lifespan` is represented as scalar. however their values will be validated accordingly to iris type definition. in addition client libraries can use its description in `JSDoc`
to generate corresponding types.

in this server, following query:

```gql
query GetDeities {
  deities {
    ... on God{
      name
      lifespan
    }
    ... on Deity_Titan{
      name
    }
  }
}
```

will return:

```json
{
  "data": {
    "deities": [
      {
        "name": "Iris",
        "lifespan": {
          "__typename": "Limited",
          "max": 200
        }
      },
      {
        "name": "Zeus"
      }
    ]
  }
}
```
