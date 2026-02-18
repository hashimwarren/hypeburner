import configPromise from '../payload.config'
import { getPayload, type Payload } from 'payload'

type GlobalWithPayload = typeof globalThis & {
  payloadClient?: Promise<Payload>
}

const globalWithPayload = globalThis as GlobalWithPayload

export const getPayloadClient = (): Promise<Payload> => {
  if (!globalWithPayload.payloadClient) {
    globalWithPayload.payloadClient = getPayload({ config: configPromise })
  }

  return globalWithPayload.payloadClient
}
