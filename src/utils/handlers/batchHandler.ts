import { ResponsePayload } from '../getResponse'
import { MockedRequest } from './requestHandler'

export interface BatchHandler {
  handler: (
    req: MockedRequest,
    payloads: ResponsePayload[],
    fallback: ResponsePayload,
  ) => ResponsePayload
}

export const defaultBatchHandler: BatchHandler = {
  handler: (req, payloads, fallback) => {
    return payloads.find((p) => !!p.response) || fallback
  },
}
