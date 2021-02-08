import { OperationTypeNode, OperationDefinitionNode, parse } from 'graphql'
import {
  RequestHandler,
  MockedRequest,
  AsyncResponseResolverReturnType,
} from './utils/handlers/requestHandler'
import { MockedResponse, ResponseComposition } from './response'
import { Mask, ResponseWithSerializedHeaders } from './setupWorker/glossary'
import { set } from './context/set'
import { status } from './context/status'
import { delay } from './context/delay'
import { fetch } from './context/fetch'
import { data, DataContext } from './context/data'
import { errors } from './context/errors'

/* Logging */
import { prepareRequest } from './utils/logging/prepareRequest'
import { prepareResponse } from './utils/logging/prepareResponse'
import { getTimestamp } from './utils/logging/getTimestamp'
import { getStatusCodeColor } from './utils/logging/getStatusCodeColor'
import { jsonParse } from './utils/internal/jsonParse'
import { matchRequestUrl } from './utils/matching/matchRequestUrl'
import { getCallFrame } from './utils/internal/getCallFrame'
import { runOrFind, runOrMap } from './utils/fp'
import { BatchHandler } from './utils/handlers/batchHandler'
import { ResponsePayload } from './utils/getResponse'

type ExpectedOperationTypeNode = OperationTypeNode | 'all'

type GraphQLRequestHandlerSelector = RegExp | string

export type GraphQLMockedRequest<VariablesType = Record<string, any>> = Omit<
  MockedRequest,
  'body'
> & {
  body: GraphQLRequestPayload<VariablesType> | undefined
}

// GraphQL related context should contain utility functions
// useful for GraphQL. Functions like `xml()` bear no value
// in the GraphQL universe.
export interface GraphQLMockedContext<QueryType> {
  set: typeof set
  status: typeof status
  delay: typeof delay
  fetch: typeof fetch
  data: DataContext<QueryType>
  errors: typeof errors
}

export const graphqlContext: GraphQLMockedContext<any> = {
  set,
  status,
  delay,
  fetch,
  data,
  errors,
}

export type GraphQLResponseResolver<QueryType, VariablesType> = (
  req: GraphQLPublicRequest<VariablesType>,
  res: ResponseComposition,
  context: GraphQLMockedContext<QueryType>,
) => AsyncResponseResolverReturnType<MockedResponse>

export type GraphQLRequestPayloadSingle<VariablesType> = {
  query: string
  operationName?: string
  variables?: VariablesType
}

export type GraphQLRequestPayload<VariablesType> =
  | GraphQLRequestPayloadSingle<VariablesType>
  | GraphQLRequestPayloadSingle<VariablesType>[]

export type GraphQLRequestParsedResultSingle<VariablesType> = {
  operationType: OperationTypeNode
  query: string
  operationName?: string
  variables?: VariablesType
}

export type GraphQLRequestParsedResult<VariablesType> =
  | GraphQLRequestParsedResultSingle<VariablesType>
  | GraphQLRequestParsedResultSingle<VariablesType>[]

type GraphQLPublicRequestBodySingle<
  VariablesType = Record<string, any>
> = GraphQLRequestPayloadSingle<VariablesType> & {
  parsed: GraphQLRequestParsedResultSingle<VariablesType>
}

export type GraphQLPublicRequest<VariablesType = Record<string, any>> = Omit<
  GraphQLMockedRequest<VariablesType>,
  'body'
> & {
  body:
    | GraphQLPublicRequestBodySingle
    | GraphQLPublicRequestBodySingle[]
    | undefined
}
interface ParsedQueryPayload {
  operationType: OperationTypeNode
  operationName?: string
}

function parseQuery(
  query: string,
  definitionOperation: ExpectedOperationTypeNode = 'query',
): ParsedQueryPayload {
  const ast = parse(query)

  const operationDef = ast.definitions.find((def) => {
    return (
      def.kind === 'OperationDefinition' &&
      (definitionOperation === 'all' || def.operation === definitionOperation)
    )
  }) as OperationDefinitionNode

  return {
    operationType: operationDef?.operation,
    operationName: operationDef?.name?.value,
  }
}

const defaultVariables = <VariablesType>(
  body: GraphQLRequestPayloadSingle<VariablesType>,
) => {
  return body.variables || ({} as VariablesType)
}

const matchParsed = <VariablesType>(
  parsedRequestResults: GraphQLRequestParsedResult<VariablesType>,
  body: GraphQLRequestPayloadSingle<VariablesType>,
) => {
  return (
    runOrFind(
      (parsedRequest) => parsedRequest.query === body.query,
      parsedRequestResults,
    ) || ({} as GraphQLRequestParsedResultSingle<VariablesType>)
  )
}

const parseRequest = <VariablesType = Record<string, any>>(
  expectedOperationType: ExpectedOperationTypeNode,
  body: GraphQLRequestPayloadSingle<VariablesType>,
): GraphQLRequestParsedResult<VariablesType> | null => {
  const { query, variables } = body

  if (!query) return null

  const { operationType, operationName } = parseQuery(
    query,
    expectedOperationType,
  )

  return {
    operationType,
    operationName,
    variables,
    query,
  }
}

const buildPublic = <VariablesType>(
  parsed: GraphQLRequestParsedResult<VariablesType>,
  body: GraphQLRequestPayloadSingle<VariablesType>,
) => {
  return {
    ...body,
    variables: defaultVariables(body),
    parsed: matchParsed(parsed, body),
  }
}

const logHandler = <QueryType, VariablesType = Record<string, any>>(
  req: GraphQLPublicRequest<VariablesType>,
  res: ResponseWithSerializedHeaders,
  handler: RequestHandler<
    GraphQLMockedRequest<VariablesType>,
    GraphQLMockedContext<QueryType>,
    GraphQLRequestParsedResult<VariablesType>,
    GraphQLPublicRequest<VariablesType>
  >,
  parsed: GraphQLRequestParsedResultSingle<VariablesType>,
) => {
  const { operationType, operationName } = parsed
  const loggedRequest = prepareRequest(req)
  const loggedResponse = prepareResponse(res)

  console.groupCollapsed(
    '[MSW] %s %s (%c%s%c)',
    getTimestamp(),
    operationName,
    `color:${getStatusCodeColor(res.status)}`,
    res.status,
    'color:inherit',
  )
  console.log('Request:', loggedRequest)
  console.log('Handler:', {
    operationType,
    operationName,
    predicate: handler.predicate(
      req as GraphQLMockedRequest<VariablesType>,
      parsed,
    ),
  })
  console.log('Response:', loggedResponse)
  console.groupEnd()
}

export const batchHandler: BatchHandler = {
  handler: (res, responsePayloads: ResponsePayload[]) => {
    const basePayload =
      responsePayloads.find(
        ({ response }) => response !== null && response !== undefined,
      ) || responsePayloads[0]

    if (Array.isArray(res.body)) {
      const bodies = responsePayloads
        .map((payload) => {
          return payload?.response?.body
            ? JSON.parse(payload.response.body)
            : undefined
        })
        .filter((b) => !!b)

      const newBodies = JSON.stringify(bodies)

      return {
        ...basePayload,
        response: {
          status: 200,
          statusText: 'OK',
          headers: res.headers,
          once: false,
          ...basePayload.response,
          body: newBodies,
        },
      }
    }
    return basePayload
  },
}

function graphQLRequestHandler<QueryType, VariablesType = Record<string, any>>(
  expectedOperationType: ExpectedOperationTypeNode,
  expectedOperationName: GraphQLRequestHandlerSelector,
  mask: Mask,
  resolver: GraphQLResponseResolver<QueryType, VariablesType>,
): RequestHandler<
  GraphQLMockedRequest<VariablesType>,
  GraphQLMockedContext<QueryType>,
  GraphQLRequestParsedResult<VariablesType>,
  GraphQLPublicRequest<VariablesType>
> {
  const callFrame = getCallFrame()

  return {
    resolver,

    parse(req) {
      // According to the GraphQL specification, a GraphQL request can be issued
      // using both "GET" and "POST" methods.
      switch (req.method) {
        case 'GET': {
          const query = req.url.searchParams.get('query')
          const variablesString = req.url.searchParams.get('variables') || ''

          if (!query) {
            return null
          }

          const variables = variablesString
            ? jsonParse<VariablesType>(variablesString)
            : ({} as VariablesType)

          return parseRequest(expectedOperationType, { query, variables })
        }

        case 'POST': {
          if (req.body === undefined) {
            return null
          }

          return runOrMap(
            (body) => parseRequest<VariablesType>(expectedOperationType, body),
            req.body,
          ) as GraphQLRequestParsedResult<VariablesType>
        }

        default:
          return null
      }
    },

    getPublicRequest(req, parsed) {
      if (req.body === undefined) {
        return {
          ...req,
          body: undefined,
        }
      }

      return {
        ...req,
        body: runOrMap(
          (body) => buildPublic<VariablesType>(parsed, body),
          req.body,
        ),
      }
    },

    predicate(req, parsed) {
      const toCheck = Array.isArray(parsed) ? parsed : [parsed]

      if (
        !parsed ||
        toCheck.some((r) => !r.operationName) // Handle batch requests
      ) {
        return false
      }

      // Match the request URL against a given mask,
      // in case of an endpoint-specific request handler.
      const hasMatchingMask = matchRequestUrl(req.url, mask)

      const hasMatchingOperations = [...toCheck].some((r) =>
        expectedOperationName instanceof RegExp
          ? expectedOperationName.test(r.operationName!)
          : expectedOperationName === r.operationName,
      )

      return hasMatchingMask.matches && hasMatchingOperations
    },

    defineContext(_req) {
      return { ...graphqlContext }
    },

    log(req, res, handler, parsed) {
      const toLog = Array.isArray(parsed) ? parsed : [parsed]

      toLog.forEach((p) =>
        logHandler<QueryType, VariablesType>(req, res, handler, p),
      )
    },

    getMetaInfo() {
      const header =
        expectedOperationType === 'all'
          ? `[graphql] ${expectedOperationType} (origin: ${mask.toString()})`
          : `[graphql] ${expectedOperationType} ${expectedOperationName} (origin: ${mask.toString()})`

      return {
        type: 'graphql',
        header,
        mask,
        callFrame,
      }
    },
  }
}

const createGraphQLScopedHandler = (
  expectedOperationType: ExpectedOperationTypeNode,
  mask: Mask,
) => {
  return <QueryType, VariablesType = Record<string, any>>(
    expectedOperationName: GraphQLRequestHandlerSelector,
    resolver: GraphQLResponseResolver<QueryType, VariablesType>,
  ): RequestHandler<
    GraphQLMockedRequest<VariablesType>,
    GraphQLMockedContext<QueryType>,
    GraphQLRequestParsedResult<VariablesType>,
    GraphQLPublicRequest<VariablesType>
  > => {
    return graphQLRequestHandler(
      expectedOperationType,
      expectedOperationName,
      mask,
      resolver,
    )
  }
}

const createGraphQLOperationHandler = (mask: Mask) => {
  return <QueryType, VariablesType = Record<string, any>>(
    resolver: GraphQLResponseResolver<QueryType, VariablesType>,
  ): RequestHandler<
    GraphQLMockedRequest<VariablesType>,
    GraphQLMockedContext<QueryType>,
    GraphQLRequestParsedResult<VariablesType>,
    GraphQLPublicRequest<VariablesType>
  > => {
    return graphQLRequestHandler('all', new RegExp('.*'), mask, resolver)
  }
}

const graphqlStandardHandlers = {
  operation: createGraphQLOperationHandler('*'),
  query: createGraphQLScopedHandler('query', '*'),
  mutation: createGraphQLScopedHandler('mutation', '*'),
}

function createGraphQLLink(uri: Mask): typeof graphqlStandardHandlers {
  return {
    operation: createGraphQLOperationHandler(uri),
    query: createGraphQLScopedHandler('query', uri),
    mutation: createGraphQLScopedHandler('mutation', uri),
  }
}

export const graphql = {
  batchHandler,
  ...graphqlStandardHandlers,
  link: createGraphQLLink,
}
