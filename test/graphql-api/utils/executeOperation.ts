import { Page, Response } from 'puppeteer'

export const HOSTNAME = 'http://localhost:8080/graphql'

/**
 * Standalone GraphQL operations dispatcher.
 */
export const graphqlOperation = (url: string) => {
  return (query: string) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    })
  }
}

interface GraphQLRequestPayload<VariablesType = Record<string, any>> {
  query: string
  variables?: VariablesType
}

interface GraphQLOperationOptions {
  uri?: string
  method?: 'GET' | 'POST'
}

const getUrl = ({ uri, method, payload }) => {
  const url = new URL(uri)

  if (method === 'GET') {
    if (Array.isArray(payload)) {
      throw new Error(`Can't use Query method on batch operation`)
    } else {
      const { query, variables } = payload
      url.searchParams.set('query', query)

      if (variables) {
        url.searchParams.set('variables', JSON.stringify(variables))
      }
    }
  }

  return url.toString()
}

const buildFetch = (url: string, method: string, body: string) => {
  return fetch(
    url,
    Object.assign(
      {},
      method === 'POST' && {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      },
    ),
  )
}

/**
 * Executes a GraphQL operation in the given Puppeteer context.
 */
export const executeOperation = async (
  page: Page,
  payload: GraphQLRequestPayload | GraphQLRequestPayload[],
  options?: GraphQLOperationOptions,
) => {
  const { uri = HOSTNAME, method = 'POST' } = options || {}
  const urlString = getUrl({ uri, method, payload })

  const responsePromise = page.evaluate(
    buildFetch,
    urlString,
    method,
    JSON.stringify(payload),
  )

  return new Promise<Response>((resolve, reject) => {
    // Propagate `fetch` exceptions to the parent Promise.
    responsePromise.catch(reject)

    return page.waitForResponse(urlString).then(resolve)
  })
}
