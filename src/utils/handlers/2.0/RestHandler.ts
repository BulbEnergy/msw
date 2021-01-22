import { Match } from 'node-match-path'
import {
  body,
  cookie,
  delay,
  fetch,
  json,
  set,
  status,
  text,
  xml,
} from '../../../context'
import {
  Mask,
  ResponseWithSerializedHeaders,
} from '../../../setupWorker/glossary'
import { isStringEqual } from '../../internal/isStringEqual'
import { getStatusCodeColor } from '../../logging/getStatusCodeColor'
import { getTimestamp } from '../../logging/getTimestamp'
import { prepareRequest } from '../../logging/prepareRequest'
import { prepareResponse } from '../../logging/prepareResponse'
import { matchRequestUrl } from '../../matching/matchRequestUrl'
import { getPublicUrlFromRequest } from '../../request/getPublicUrlFromRequest'
import {
  DefaultRequestBodyType,
  MockedRequest,
  ResponseResolver,
} from '../requestHandler'
import { RequestHandler } from './RequestHandler'

interface RestHandlerInfo {
  method: string
  mask: Mask
}

export enum RESTMethods {
  HEAD = 'HEAD',
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
  DELETE = 'DELETE',
}

// Declaring a context interface infers
// JSDoc description of the referenced utils.
export interface RestContext {
  set: typeof set
  status: typeof status
  cookie: typeof cookie
  text: typeof text
  body: typeof body
  json: typeof json
  xml: typeof xml
  delay: typeof delay
  fetch: typeof fetch
}

export const restContext: RestContext = {
  set,
  status,
  cookie,
  body,
  text,
  json,
  xml,
  delay,
  fetch,
}

export type RequestParams = {
  [paramName: string]: any
}

export interface RestPublicRequestType<ParamsType extends RequestParams>
  extends MockedRequest {
  params: ParamsType
}

interface ParsedResult {
  match: Match
}

export class RestHandler<
  RequestType extends MockedRequest<DefaultRequestBodyType>
> extends RequestHandler<
  RestHandlerInfo,
  RequestType,
  ParsedResult,
  RestPublicRequestType<RequestParams>
> {
  constructor(
    method: string,
    mask: Mask,
    resolver: ResponseResolver<any, any>,
  ) {
    super({
      info: {
        header: `${method} ${mask}`,
        mask,
        method,
      },
      ctx: restContext as any,
      resolver,
    })
  }

  parse(request: RequestType) {
    const match = matchRequestUrl(request.url, this.info.mask)

    return {
      match,
    }
  }

  getPublicRequest(
    request: RequestType,
    parsedResult: ParsedResult,
  ): RestPublicRequestType<RequestParams> {
    return {
      ...request,
      params: parsedResult.match.params,
    }
  }

  predicate(req: RequestType, parsedResult: ParsedResult) {
    return (
      isStringEqual(this.info.method, req.method) && parsedResult.match.matches
    )
  }

  log(request: RequestType, response: ResponseWithSerializedHeaders<any>) {
    const publicUrl = getPublicUrlFromRequest(request)
    const loggedRequest = prepareRequest(request)
    const loggedResponse = prepareResponse(response)

    console.groupCollapsed(
      '[MSW] %s %s %s (%c%s%c)',
      getTimestamp(),
      request.method,
      publicUrl,
      `color:${getStatusCodeColor(response.status)}`,
      response.status,
      'color:inherit',
    )
    console.log('Request', loggedRequest)
    console.log('Handler:', {
      mask: this.info.mask,
      resolver: this.resolver,
    })
    console.log('Response', loggedResponse)
    console.groupEnd()
  }
}
