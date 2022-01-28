import type { ParseOptions, Source } from 'graphql';

import { devAssert } from '../jsutils/devAssert';

import type { DocumentNode } from '../language/ast';
import { IrisKind } from '../language/kinds';
import { parse } from '../language/parser';

import { specifiedDirectives } from '../type/directives';
import type { GraphQLSchemaValidationOptions } from '../type/schema';
import { GraphQLSchema } from '../type/schema';

import { validateSDL } from '../validation/validate';

import { extendSchemaImpl } from './extendSchema';

export interface BuildSchemaOptions extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean;
}

export function assertValidSDL(documentAST: DocumentNode): void {
  const errors = validateSDL(documentAST);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query,
 * Mutation and Subscription.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 */
export function buildASTSchema(
  documentAST: DocumentNode,
  options?: BuildSchemaOptions,
): GraphQLSchema {
  devAssert(
    documentAST != null && documentAST.kind === IrisKind.DOCUMENT,
    'Must provide valid Document AST.',
  );

  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    assertValidSDL(documentAST);
  }

  const emptySchemaConfig = {
    description: undefined,
    types: [],
    directives: [],
    extensions: Object.create(null),
    extensionASTNodes: [],
    assumeValid: false,
  };
  const config = extendSchemaImpl(emptySchemaConfig, documentAST, options);

  for (const type of config.types) {
    switch (type.name) {
      // Note: While this could make early assertions to get the correctly
      // typed values below, that would throw immediately while type system
      // validation with validateSchema() will produce more actionable results.
      case 'Query':
        // @ts-expect-error validated in `validateSchema`
        config.query = type;
        break;
      case 'Mutation':
        // @ts-expect-error validated in `validateSchema`
        config.mutation = type;
        break;
      case 'Subscription':
        // @ts-expect-error validated in `validateSchema`
        config.subscription = type;
        break;
    }
  }

  const directives = [
    ...config.directives,
    // If specified directives were not explicitly declared, add them.
    ...specifiedDirectives.filter((stdDirective) =>
      config.directives.every(
        (directive) => directive.name !== stdDirective.name,
      ),
    ),
  ];

  return new GraphQLSchema({ ...config, directives });
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(
  source: string | Source,
  options?: BuildSchemaOptions & ParseOptions,
): GraphQLSchema {
  const document = parse(source, {
    noLocation: options?.noLocation,
    allowLegacyFragmentVariables: options?.allowLegacyFragmentVariables,
  });

  return buildASTSchema(document, {
    assumeValidSDL: options?.assumeValidSDL,
    assumeValid: options?.assumeValid,
  });
}
