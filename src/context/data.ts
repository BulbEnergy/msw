import { ResponseTransformer } from '../response'
import { runOrMap } from '../utils/fp'
import { json } from './json'

export type DataContext<T> = (payload: T) => ResponseTransformer

const wrapWithData = (payload: any) => ({
  data: payload,
})

/**
 * Returns a GraphQL body payload.
 */
export const data: DataContext<Record<string, any> | Record<string, any>[]> = (
  payload,
) => {
  return json(runOrMap(wrapWithData, payload), {
    merge: !Array.isArray(payload),
  })
}
