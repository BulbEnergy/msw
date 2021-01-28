import * as path from 'path'
import { captureConsole, filterLibraryLogs } from '../support/captureConsole'
import { runBrowserWith } from '../support/runBrowserWith'
import { executeOperation } from './utils/executeOperation'

function createRuntime() {
  return runBrowserWith(path.resolve(__dirname, 'query.mocks.ts'))
}

test('mocks a GraphQL query issued with a GET request', async () => {
  const runtime = await createRuntime()

  const res = await executeOperation(
    runtime.page,
    {
      query: `
      query GetUserDetail {
        user {
          firstName
          lastName
        }
      }
    `,
    },
    {
      method: 'GET',
    },
  )

  const headers = res.headers()
  const body = await res.json()

  expect(res.status()).toEqual(200)
  expect(headers).toHaveProperty('content-type', 'application/json')
  expect(body).toEqual({
    data: {
      user: {
        firstName: 'John',
        lastName: 'Maverick',
      },
    },
  })

  await runtime.cleanup()
})

test('mocks a GraphQL query issued with a POST request', async () => {
  const runtime = await createRuntime()

  const res = await executeOperation(runtime.page, {
    query: `
      query GetUserDetail {
        user {
          firstName
          lastName
        }
      }
    `,
  })
  const headers = res.headers()
  const body = await res.json()

  expect(res.status()).toEqual(200)
  expect(headers).toHaveProperty('content-type', 'application/json')
  expect(body).toEqual({
    data: {
      user: {
        firstName: 'John',
        lastName: 'Maverick',
      },
    },
  })

  await runtime.cleanup()
})

test('mocks a GraphQL query issued with a batch request', async () => {
  const runtime = await createRuntime()

  const GET_USER_QUERY = `
    query GetUser($id: String!) {
      query
      variables
    }`

  const GET_USER_DETAILS = `
    query GetUserDetail {
      user {
        firstName
        lastName
      }
    }`

  const res = await executeOperation(runtime.page, [
    {
      query: GET_USER_QUERY,
      variables: {
        id: 'abc-123',
      },
    },
    {
      query: GET_USER_DETAILS,
    },
  ])
  const headers = res.headers()
  const body = await res.json()

  expect(res.status()).toEqual(200)
  expect(headers).toHaveProperty('content-type', 'application/json')
  expect(body).toEqual([
    {
      data: {
        user: {
          firstName: 'John',
          lastName: 'Maverick',
        },
      },
    },
    {
      data: {
        query: GET_USER_QUERY,
        variables: {
          id: 'abc-123',
        },
      },
    },
  ])

  await runtime.cleanup()
})
