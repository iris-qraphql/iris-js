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
import { irisSchema } from 'iris';

const schema = irisSchema(`
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
`);
```

schema defined above can be used by regular graphql.

```js
var source = `
    { deities { 
        __typename
        ... on God {
          name
          lifespan
        }
        ... on Deity_Titan {
          name
        }
      } 
    }
  `;

graphql({ schema, source }).then((result) => {
  // Prints
  // {
  //   data: { hello: "world" }
  // }
  console.log(result);
});
```
