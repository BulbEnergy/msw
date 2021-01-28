import { setupWorker, graphql } from 'msw'

const getResponse = (b) => ({
  query: b.query,
  variables: b.variables,
})

const worker = setupWorker(
  graphql.operation((req, res, ctx) => {
    return res(
      ctx.data(
        Array.isArray(req.body)
          ? req.body.map(getResponse)
          : getResponse(req.body),
      ),
    )
  }),
)

worker.start()
