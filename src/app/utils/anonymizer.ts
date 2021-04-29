import * as faker from 'faker';
import { IOhMyMockRule } from '@shared/type';

// DOC: https://github.com/Marak/Faker.js

export const firstName = (): string => {
  return faker.name.firstName();
}

export const lastName = (): string => {
  return faker.name.firstName();
}

export const middleName = (): string => {
  return faker.name.middleName();
}

export const fullName = (): string => {
  return `${firstName()} ${faker.name.lastName()}`;
}

export const password = (): string => {
  return faker.internet.password();
}

export const username = (): string => {
  return faker.internet.userName();
}

export const generators = {
  firstName,
  lastName,
  middleName,
  fullName,
  password,
  username
}
