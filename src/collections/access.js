const isAdmin = ({ req }) => {
  const user = req?.user
  return user?.role === 'admin'
}

const adminOnlyWrite = ({ req }) => {
  const user = req?.user
  return user?.role === 'admin'
}

const publishedOrAdminRead = ({ req }) => {
  const user = req?.user
  if (user?.role === 'admin') return true

  return {
    status: {
      equals: 'published',
    },
  }
}

module.exports = {
  isAdmin,
  adminOnlyWrite,
  publishedOrAdminRead,
}
