# Iris.js

The JavaScript implementation for Iris

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

GraphQL server is running on: http://localhost:4000.

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
  deities: [Deity!]!
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
