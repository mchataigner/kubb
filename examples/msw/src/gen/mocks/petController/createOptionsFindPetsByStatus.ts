import type { OptionsFindPetsByStatus200, OptionsFindPetsByStatusMutationResponse } from '../../models/OptionsFindPetsByStatus.ts'
import { createPet } from '../createPet.ts'
import { faker } from '@faker-js/faker'

/**
 * @description successful operation
 */
export function createOptionsFindPetsByStatus200(data?: Partial<OptionsFindPetsByStatus200>): OptionsFindPetsByStatus200 {
  faker.seed([220])
  return [...(faker.helpers.multiple(() => createPet()) as any), ...(data || [])]
}

export function createOptionsFindPetsByStatusMutationResponse(
  data?: Partial<OptionsFindPetsByStatusMutationResponse>,
): OptionsFindPetsByStatusMutationResponse {
  faker.seed([220])
  return data || faker.helpers.arrayElement<any>([createOptionsFindPetsByStatus200()])
}
