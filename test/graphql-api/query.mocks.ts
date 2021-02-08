import { setupWorker, graphql } from 'msw'

const GET_USER_QUERY = `
    query GetUser($id: String!) {
      query
      variables
    }`

const worker = setupWorker(
  graphql.query('GetUserDetail', (req, res, ctx) => {
    return res(
      ctx.data({
        user: {
          firstName: 'John',
          lastName: 'Maverick',
        },
      }),
    )
  }),
  graphql.query('GetUser', (req, res, ctx) => {
    return res(
      ctx.data({
        query: GET_USER_QUERY,
        variables: {
          id: 'abc-123',
        },
      }),
    )
  }),
)

worker.setBatchHandler(graphql.batchHandler)

worker.start()
