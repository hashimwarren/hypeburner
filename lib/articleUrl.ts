/** Build a public URL from raw CMS path data, without a deployment prefix.
 * Literal ?, # and % belong to slug segments; browser URLs must never be passed here.
 */
export function articleUrl(
  publicSiteUrl: string,
  rawContentPath: string,
  deploymentBasePath?: string
): string {
  const site = new URL(publicSiteUrl)
  // Select one configured prefix: siteUrl may already contain the deployment base path.
  const prefix = (deploymentBasePath || site.pathname).replace(/^\/+|\/+$/g, '')
  const path = rawContentPath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')
  return `${site.origin}/${prefix ? `${prefix}/` : ''}${path}`
}
