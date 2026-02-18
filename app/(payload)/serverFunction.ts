'use server'

import { handleServerFunctions } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'

export const serverFunction: ServerFunctionClient = async (args) => {
  return handleServerFunctions(args)
}
