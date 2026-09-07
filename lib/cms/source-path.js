/** @param {unknown} value @returns {string} */
function normalizeSourcePath(value) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cs}]/u.test(value)) return ''

  const path = value.trim().replace(/^data\//, '')
  if (!path.startsWith('blog/') || /[\\%?#:]/.test(path)) return ''

  const segments = path.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return ''
  if (!/^.+\.mdx?$/.test(segments[segments.length - 1])) return ''

  return path
}

module.exports = normalizeSourcePath
