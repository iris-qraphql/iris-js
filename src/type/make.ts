import type { ObjMap } from '../jsutils/ObjMap';

import type { GraphQLInputField } from './definition';
import { IrisDataType } from './definition';

type InputC = {
  name: string;
  fields: ObjMap<Omit<GraphQLInputField, 'name'>>;
};

export const emptyDataType = (name: string) => new IrisDataType({ name });

const gqlInput = ({ name, fields }: InputC) =>
  new IrisDataType({
    name,
    variants: [
      {
        name,
        fields,
      },
    ],
  });

const gqlEnum = (name: string, values: Array<string>) =>
  new IrisDataType({
    name,
    variants: values.map((v) => ({ name: v })),
  });

export { gqlInput, gqlEnum };
