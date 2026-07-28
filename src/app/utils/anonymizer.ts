import { faker } from '@faker-js/faker';

// DOC: https://github.com/Marak/Faker.js

export const firstName = (): string => {
  return faker.person.firstName();
}

export const lastName = (): string => {
  return faker.person.lastName();
}

export const middleName = (): string => {
  return faker.person.middleName();
}

export const fullName = (): string => {
  return `${firstName()} ${lastName()}`;
}

export const password = (): string => {
  return faker.internet.password();
}

export const username = (): string => {
  return faker.internet.username();
}

export const generators = {
  firstName,
  lastName,
  middleName,
  fullName,
  password,
  username
}
