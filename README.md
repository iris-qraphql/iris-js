# Iris.js

The JavaScript implementation for Iris

## Getting Started

### Using Iris.js

Install Iris.js from npm

With npm:

```sh
npm install --save iris
```

or using yarn:

```sh
yarn add iris
```

iris.js provides two important capabilities: building a type schema and
serving queries against that type schema.

First, build a Iris type schema which maps to your codebase.

```js
import { iris, buildSchema } from 'iris';

const schema = buildSchema(`
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

This defines a simple schema, with one type and one field, that resolves
to a fixed value. The `resolve` function can return a value, a promise,
Then, serve the result of a query against that type schema.

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
  `

iris({ schema, source }).then((result) => {
  // Prints
  // {
  //   data: { hello: "world" }
  // }
  console.log(result);
});
```
