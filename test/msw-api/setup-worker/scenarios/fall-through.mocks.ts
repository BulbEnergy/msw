import { setupWorker, rest, graphql } from 'msw'

const worker = setupWorker(
  rest.get('*', () => console.log('[get] first')),
  rest.get('/us*', () => console.log('[get] second')),
  rest.get('/user', (req, res, ctx) => res(ctx.json({ firstName: 'John' }))),
  rest.get('/user', () => console.log('[get] third')),

  rest.post('/blog/*', () => console.log('[post] first')),
  rest.post('/blog/article', () => console.log('[post] second')),

  graphql.query(/UserDetail$/, (req, res, ctx) => {
    console.log('[query] first')
  }),
  graphql.query(/^Get(.+?)Detail$/, (req, res, ctx) => {
    console.log('[query] second')
  }),
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
  graphql.query('GetUserDetail', (req, res, ctx) => {
    console.log('[query] third')
  }),
)

worker.setBatchHandler(graphql.batchHandler)

worker.start()
