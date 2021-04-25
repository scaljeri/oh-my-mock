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

const generators = {
  firstName,
  lastName,
  middleName,
  fullName,
  password,
  username
}

export const applyRules = (json: unknown, rules: IOhMyMockRule[] = []): unknown => {
  let output = json;

  rules.forEach(r => {
    output = applyRule(output, r);
  });

  return output;
}

export const applyRule = (json: any, rule: IOhMyMockRule): unknown => {
  let output;

  if (Array.isArray(json)) {
    output = [...json];
    output = output.map(o => applyRule(o, rule));
  } else {
    output = { ...json };
    const parts = rule.path.split('.');
    const key = parts.shift();

    if (parts.length > 0) {
      if (key === '*') {
        Object.keys(output).forEach(k => {
          output[k] = applyRule(output[k], { ...rule, path: parts.join('.') });
        })
      } else if (output[key]) {
        output[key] = applyRule(output[key], { ...rule, path: parts.join('.') });
      } else {
        console.log('Key ' + key + ' not found');
      }
    } else {
      output[key] = generators[rule.type]()
    }
  }

  return output;
}
