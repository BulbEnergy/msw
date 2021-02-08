import { ResponsePayload } from '../getResponse'
import { MockedRequest } from './requestHandler'

export interface BatchHandler {
  handler: (req: MockedRequest, payloads: ResponsePayload[]) => ResponsePayload
}

export const defaultBatchHandler: BatchHandler = {
  handler: (req, payloads) => {
    return (
      payloads.find(
        ({ response }) => response !== null && response !== undefined,
      ) || payloads[0]
    )
  },
}
