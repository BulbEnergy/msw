import {
  ResponseTransformer,
  response,
  MockedResponse,
} from '../../../response'
import { getCallFrame } from '../../internal/getCallFrame'
import {
  defaultContext,
  MockedRequest,
  ResponseResolver,
} from '../requestHandler'

interface RequestHandlerDefaultInfo {
  callFrame?: string
}

type RequestHandlerInfo<ExtraInfo extends Record<string, any>> = {
  header: string
} & ExtraInfo

type ContextMap = Record<string, (...args: any) => ResponseTransformer>

export interface RequestHandlerOptions<HandlerInfo> {
  info: RequestHandlerInfo<HandlerInfo>
  resolver: ResponseResolver
  ctx?: ContextMap
}

export interface RequestHandlerExecutionResult<PublicRequestType> {
  handler: RequestHandler
  parsedResult: any
  request: PublicRequestType
  response?: MockedResponse
}

export abstract class RequestHandler<
  HandlerInfo extends Record<string, any> = Record<string, any>,
  RequestType extends MockedRequest = MockedRequest,
  ParsedResult = any,
  PublicRequestType extends MockedRequest = RequestType
> {
  public info: RequestHandlerDefaultInfo & RequestHandlerInfo<HandlerInfo>
  private ctx: ContextMap
  private shouldSkip: boolean
  protected resolver: ResponseResolver<any, any>

  constructor(options: RequestHandlerOptions<HandlerInfo>) {
    this.shouldSkip = false
    this.ctx = options.ctx || defaultContext
    this.resolver = options.resolver

    const callFrame = getCallFrame()

    this.info = {
      ...options.info,
      callFrame,
    }
  }

  /**
   * Tests if this handler matches the given request.
   */
  public test(request: RequestType): boolean {
    return this.predicate(request, this.parse(request))
  }

  /**
   * Execute this request handler and produce a mocked response
   * using the given resolver function.
   */
  public async run(
    request: RequestType,
  ): Promise<RequestHandlerExecutionResult<PublicRequestType> | null> {
    if (this.shouldSkip) {
      return null
    }

    const parsedResult = this.parse(request)
    const shouldIntercept = this.predicate(request, parsedResult)

    if (!shouldIntercept) {
      return null
    }

    const publicRequest = this.getPublicRequest(request, parsedResult)
    const mockedResponse = await this.resolver(
      publicRequest,
      response,
      this.ctx,
    )

    return this.createExecutionResult(
      parsedResult,
      publicRequest,
      mockedResponse,
    )
  }

  public markAsSkipped(shouldSkip = true) {
    this.shouldSkip = shouldSkip
  }

  private createExecutionResult(
    parsedResult: ParsedResult,
    request: PublicRequestType,
    response: any,
  ): RequestHandlerExecutionResult<PublicRequestType> {
    return {
      handler: this,
      parsedResult: parsedResult || null,
      request,
      response: response || null,
    }
  }

  abstract parse(request: RequestType): ParsedResult
  abstract predicate(request: RequestType, parsedResult: ParsedResult): boolean
  abstract log(
    request: RequestType,
    res: any,
    handler: this,
    parsedResilt: ParsedResult,
  ): void
  abstract getPublicRequest(
    request: RequestType,
    parsedResult: ParsedResult,
  ): PublicRequestType
}
