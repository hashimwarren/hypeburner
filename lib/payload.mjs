import configPromise from '../payload.config'
import { getPayload } from 'payload'

let payloadClientPromise

export const getPayloadClient = () => {
  if (!payloadClientPromise) {
    payloadClientPromise = getPayload({ config: configPromise })
  }

  return payloadClientPromise
}
