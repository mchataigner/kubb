import client from '../../../../tanstack-query-client'
import type { RequestConfig, ResponseErrorConfig, ResponseConfig } from '../../../../tanstack-query-client'
import type { QueryKey, QueryObserverOptions, UseQueryResult } from '../../../../tanstack-query-hook'
import type { GetPetByIdQueryResponse, GetPetByIdPathParams, GetPetById400, GetPetById404 } from '../../../models/ts/petController/GetPetById.ts'
import { queryOptions, useQuery } from '../../../../tanstack-query-hook'
import { getPetByIdQueryResponseSchema } from '../../../zod/petController/getPetByIdSchema.ts'

export const getPetByIdQueryKey = ({ petId }: { petId: GetPetByIdPathParams['petId'] }) => [{ url: '/pet/:petId', params: { petId: petId } }] as const

export type GetPetByIdQueryKey = ReturnType<typeof getPetByIdQueryKey>

/**
 * @description Returns a single pet
 * @summary Find pet by ID
 * {@link /pet/:petId}
 */
async function getPetById({ petId }: { petId: GetPetByIdPathParams['petId'] }, config: Partial<RequestConfig> = {}) {
  const res = await client<GetPetByIdQueryResponse, ResponseErrorConfig<GetPetById400 | GetPetById404>, unknown>({
    method: 'GET',
    url: `/pet/${petId}`,
    ...config,
  })
  return { ...res, data: getPetByIdQueryResponseSchema.parse(res.data) }
}

export function getPetByIdQueryOptions({ petId }: { petId: GetPetByIdPathParams['petId'] }, config: Partial<RequestConfig> = {}) {
  const queryKey = getPetByIdQueryKey({ petId })
  return queryOptions<
    ResponseConfig<GetPetByIdQueryResponse>,
    ResponseErrorConfig<GetPetById400 | GetPetById404>,
    ResponseConfig<GetPetByIdQueryResponse>,
    typeof queryKey
  >({
    enabled: !!petId,
    queryKey,
    queryFn: async ({ signal }) => {
      config.signal = signal
      return getPetById({ petId }, config)
    },
  })
}

/**
 * @description Returns a single pet
 * @summary Find pet by ID
 * {@link /pet/:petId}
 */
export function useGetPetById<
  TData = ResponseConfig<GetPetByIdQueryResponse>,
  TQueryData = ResponseConfig<GetPetByIdQueryResponse>,
  TQueryKey extends QueryKey = GetPetByIdQueryKey,
>(
  { petId }: { petId: GetPetByIdPathParams['petId'] },
  options: {
    query?: Partial<
      QueryObserverOptions<ResponseConfig<GetPetByIdQueryResponse>, ResponseErrorConfig<GetPetById400 | GetPetById404>, TData, TQueryData, TQueryKey>
    >
    client?: Partial<RequestConfig>
  } = {},
) {
  const { query: queryOptions, client: config = {} } = options ?? {}
  const queryKey = queryOptions?.queryKey ?? getPetByIdQueryKey({ petId })

  const query = useQuery({
    ...(getPetByIdQueryOptions({ petId }, config) as unknown as QueryObserverOptions),
    queryKey,
    ...(queryOptions as unknown as Omit<QueryObserverOptions, 'queryKey'>),
  }) as UseQueryResult<TData, ResponseErrorConfig<GetPetById400 | GetPetById404>> & { queryKey: TQueryKey }

  query.queryKey = queryKey as TQueryKey

  return query
}
