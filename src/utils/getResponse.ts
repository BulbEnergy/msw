import { RequestHandlersList } from '../setupWorker/glossary'
import {
  RequestHandler,
  MockedRequest,
  defaultContext,
} from './handlers/requestHandler'
import { MockedResponse, response as baseResponse } from '../response'
import { BatchHandler } from './handlers/batchHandler'

export interface ResponsePayload {
  response: MockedResponse | null
  handler: RequestHandler<any, any> | null
  publicRequest?: any
  parsedRequest?: any
}

/**
 * Returns a mocked response for a given request using following request handlers.
 */
export const getResponse = async <
  R extends MockedRequest,
  H extends RequestHandlersList
>(
  req: R,
  handlers: H,
  batchHandler: BatchHandler,
): Promise<ResponsePayload> => {
  const relevantHandlers = handlers
    .filter((requestHandler) => {
      // Skip a handler if it has been already used for a one-time response.
      return !requestHandler.shouldSkip
    })
    .map<[RequestHandler<any, any>, any, boolean]>((requestHandler) => {
      // Parse the captured request to get additional information.
      // Make the predicate function accept all the necessary information
      // to decide on the interception.
      const parsedRequest = requestHandler.parse
        ? requestHandler.parse(req)
        : null

      const isRelevant = requestHandler.predicate(req, parsedRequest)
      return [requestHandler, parsedRequest, isRelevant]
    })
    .filter(([, , isRelevant]) => isRelevant)

  if (relevantHandlers.length === 0) {
    // Handle a scenario when a request has no relevant request handlers.
    // In that case it would be bypassed (performed as-is).
    return {
      handler: null,
      response: null,
    }
  }

  const responsePayloads: ResponsePayload[] = await Promise.all(
    relevantHandlers.map(async ([handler, parsedRequest]) => {
      const { getPublicRequest, defineContext, resolver } = handler

      const publicRequest = getPublicRequest
        ? getPublicRequest(req, parsedRequest)
        : req

      const context = defineContext
        ? defineContext(publicRequest)
        : defaultContext

      const response = ((await resolver(
        publicRequest,
        baseResponse,
        context,
      )) || null) as MockedResponse

      handler.shouldSkip = response?.once

      return {
        handler,
        response,
        parsedRequest,
        publicRequest,
      }
    }),
  )

  return (
    batchHandler.handler(req, responsePayloads) || {
      handler: null,
      response: null,
    }
  )
}
