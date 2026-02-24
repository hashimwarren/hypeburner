import configPromise from '../../../../payload.config'
import { GRAPHQL_PLAYGROUND_GET, GRAPHQL_POST } from '@payloadcms/next/routes'

export const runtime = 'nodejs'

export const GET = GRAPHQL_PLAYGROUND_GET(configPromise)
export const POST = GRAPHQL_POST(configPromise)
