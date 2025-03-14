import { faker } from '@faker-js/faker'

export function pets(data?: Partial<Pets>): Pets {
  return [...(faker.helpers.multiple(() => pet()) as any), ...(data || [])]
}
