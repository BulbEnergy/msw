/**
 * @jest-environment node
 */
import { createApolloFetch } from 'apollo-fetch'
import { setupServer } from 'msw/node'
import { graphql } from 'msw'

const TEST_URL = 'http://test.mswjs.io/user/graphql'

const fetch = createApolloFetch({
  uri: `${TEST_URL}`,
})

fetch.useAfter(({ response }, next) => {
  if (response.status >= 400) {
    response.parsed = { errors: 'Network error' }
  }
  next()
})

const server = setupServer(
  graphql.query('GetUserDetail', (req, res, ctx) => {
    console.log('GetUserDetail')
    const batched = Array.isArray(req.body)
    const body = batched ? req.body[0] : req.body
    console.log('setupServer GetUserDetail')
    const { userId } = body.variables
    const data = {
      user: {
        id: userId,
        firstName: 'John',
        age: 32,
      },
    }
    return res(ctx.data(batched ? [data] : data))
  }),
)

const GET_USER_DETAIL = `
query GetUserDetail($userId: String!) {
  user {
    id,
    firstName
    age
  }
}`

const GET_USER_QUERY = `
query GetUser($id: String!) {
  query
  variables
}`

beforeAll(() => {
  return server.listen()
})

afterAll(() => {
  server.close()
  jest.restoreAllMocks()
})

test('bypasses unhandled graphql requests by default', async () => {
  jest.spyOn(global.console, 'error')
  jest.spyOn(global.console, 'warn')

  const res = await fetch({
    query: GET_USER_QUERY,
    variables: {
      id: '123-abc',
    },
  })
  // Request should be performed as-is
  expect(res).toHaveProperty('errors')

  // No warnings/errors should be printed
  expect(console.error).not.toBeCalled()
  expect(console.warn).not.toBeCalled()
})

test('bypasses unhandled batch graphql requests by default', async () => {
  jest.spyOn(global.console, 'error')
  jest.spyOn(global.console, 'warn')

  const res = await fetch([
    {
      query: GET_USER_QUERY,
      variables: {
        id: '123-abc',
      },
    },
  ])
  // Request should be performed as-is
  expect(res[0]).toHaveProperty('errors')

  // No warnings/errors should be printed
  expect(console.error).not.toBeCalled()
  expect(console.warn).not.toBeCalled()
})

test('bypasses unhandled batch graphql requests and handles provided resolvers by default', async () => {
  jest.spyOn(global.console, 'error')
  jest.spyOn(global.console, 'warn')

  const res = await fetch([
    {
      query: GET_USER_QUERY,
      variables: {
        id: '123-abc',
      },
    },
    {
      query: GET_USER_DETAIL,
      variables: {
        userId: 'abc-123',
      },
    },
  ])

  // UNMATCHED query should be performed as-is
  expect(res[0]).toHaveProperty('errors')
  // Matched query (GetUserDetail) should return mocked data
  expect(res[1]).toEqual({
    data: { user: { age: 32, firstName: 'John', id: 'abc-123' } },
  })

  // No warnings/errors should be printed
  expect(console.error).not.toBeCalled()
  expect(console.warn).not.toBeCalled()
})
