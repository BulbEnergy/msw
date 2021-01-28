import { setupWorker, graphql, ResponsePayload } from 'msw'

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

worker.setBatchHandler({
  handler: (res, responsePayloads: ResponsePayload[]) => {
    const basePayload = responsePayloads[0]

    if (Array.isArray(res.body)) {
      const bodies = responsePayloads
        .map((payload) => {
          return payload.response.body
            ? JSON.parse(payload.response.body)
            : undefined
        })
        .filter((b) => !!b)

      const newBodies = JSON.stringify(bodies)

      return {
        ...basePayload,
        response: {
          ...basePayload.response,
          body: newBodies,
        },
      }
    } else {
      return basePayload
    }
  },
})

worker.start()
