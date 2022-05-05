# Iris.js

The JavaScript implementation for Iris

## What is Iris?

Iris.js is a schema definition language for GraphLQ apis,
which provides flexibility and type safety. The schema generated by iris can be used by regular Graphql servers (Apollo, Express,..).

## Motivation

- GraphQL forces the client to select fields of types, which is not well suited for server-to-server applications (where you don't need selectivity, like in RPC) and is causing difficulties with recursive data types (like tree types).
- Default values for GraphQL inputs are dangerous for recursive data types.
- GraphQL does not support input unions
- the separation between input and output types is not always practical and leads to a verbose schema definition.
- GraphQL uses several limited entities to cover sum and product types that could be replaced by small but powerful entities like ADT.

Iris solutions.

- in Iris you can use "data" types that can be used for both input and output and do not force the client to select fields.
- default values in iris are only allowed on arguments.
- iris uses only 3 entities `wrapping`, `data` and `resolver` types. where `data` and `resolver` are represented with identical `ADT` syntax. the type `data` covers also the case of input union.

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
