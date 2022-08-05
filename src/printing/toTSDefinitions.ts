
import type { TypeDefinitionNode } from '../types/ast';
import type { IrisSchema } from '../types/schema';

export const toTSDefinitions = (
  schema: IrisSchema,
): string => {

  // const transpileField =
  //   (resolvers: any) =>
  //   (
  //     { description, type, args }: IrisField<'resolver'>,
  //     name: string,
  //   ): GraphQLFieldConfig<any, any> => ({
  //     description,
  //     type: transpileTypeRef(type),
  //     resolve: resolvers[name],
  //     args: args ? Object.fromEntries(args.map(transpileArgument)) : undefined,
  //   });

  // const transpileTypeRef = (
  //   type: IrisTypeRef,
  //   isMaybe?: boolean,
  // ): GraphQLOutputType => {
  //   const withMaybe = (t: GraphQLOutputType) =>
  //     isMaybe ? t : new GraphQLNonNull(t);
  //   switch (type.kind) {
  //     case 'MAYBE':
  //       return transpileTypeRef(type.ofType, true);
  //     case 'LIST':
  //       return withMaybe(new GraphQLList(transpileTypeRef(type.ofType)));
  //     case 'NAMED':
  //       return withMaybe(lookup(type.ofType.name));
  //   }
  // };


  const transpileTypeDefinition = (
    type: TypeDefinitionNode,
  ): string => {
    const { name } = type;

    return `type ${name.value} = {}`;
  };


  return Object.values(schema.types).map(transpileTypeDefinition).join('\n'); 
};
