import type { Access } from 'payload'

type RoleUser = {
  role?: string
}

export const isAdmin: Access = ({ req }) => {
  const user = req.user as RoleUser | undefined
  return user?.role === 'admin'
}

export const adminOnlyWrite: Access = ({ req }) => {
  const user = req.user as RoleUser | undefined
  return user?.role === 'admin'
}

export const publishedOrAdminRead: Access = ({ req }) => {
  const user = req.user as RoleUser | undefined
  if (user?.role === 'admin') return true

  return {
    status: {
      equals: 'published',
    },
  }
}
