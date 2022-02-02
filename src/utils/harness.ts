import { parse } from '../language/parser';

import { buildSchema } from '../type/buildASTSchema';
import type { IrisSchema } from '../type/schema';

import { validateSDL } from '../validation/validate';
import type { SDLValidationRule } from '../validation/ValidationContext';

import { toJSONDeep } from './toJSONDeep';
import type { Maybe } from './type-level';

export const testSchema: IrisSchema = buildSchema(`
  resolver Pet = {
    name(surname: Boolean): String
  }

  data DogCommand 
    = SIT {}
    | HEEL {}
    | DOWN {}

  resolver Dog = {
    name(surname: Boolean): String
    nickname: String
    barkVolume: Int
    barks: Boolean
    doesKnowCommand(dogCommand: DogCommand): Boolean
    isHouseTrained(atOtherHomes: Boolean = true): Boolean
    isAtLocation(x: Int, y: Int): Boolean
    mother: Dog
    father: Dog
  }

  resolver Cat = {
    name(surname: Boolean): String
    nickname: String
    meows: Boolean
    meowsVolume: Int
    furColor: FurColor
  }

  resolver CatOrDog = Cat | Dog

  resolver Human = {
    name(surname: Boolean): String
    pets: [Pet]
    relatives: [Human]
  }

  data FurColor 
    = BROWN {}
    | BLACK {}
    | TAN {}
    | SPOTTED {}
    | NO_FUR {}
    | UNKNOWN {}

  data ComplexInput = {
    requiredField: Boolean
    intField: Int
    stringField: String
    booleanField: Boolean
    stringListField: [String]
  }

  resolver ComplicatedArgs = {
    intArgField(intArg: Int): String
    nonNullIntArgField(nonNullIntArg: Int): String
    stringArgField(stringArg: String): String
    booleanArgField(booleanArg: Boolean): String
    enumArgField(enumArg: FurColor): String
    floatArgField(floatArg: Float): String
    idArgField(idArg: ID): String
    stringListArgField(stringListArg: [String]): String
    stringListNonNullArgField(stringListNonNullArg: [String]): String
    complexArgField(complexArg: ComplexInput): String
    multipleReqs(req1: Int, req2: Int?): String
    nonNullFieldWithDefault(arg: Int = 0): String
    multipleOpts(opt1: Int = 0, opt2: Int = 0): String
    multipleOptAndReq(req1: Int, req2: Int, opt1: Int = 0, opt2: Int? = 0): String
  }

  resolver Query = {
    human(id: ID): Human
    dog: Dog
    cat: Cat
    pet: Pet
    catOrDog: CatOrDog
    complicatedArgs: ComplicatedArgs
  }

  directive @onField on FIELD
`);

export function getSDLValidationErrors(
  schema: Maybe<IrisSchema>,
  rule: SDLValidationRule,
  sdlStr: string,
): any {
  const doc = parse(sdlStr);
  const errors = validateSDL(doc, schema, [rule]);
  return toJSONDeep(errors);
}
