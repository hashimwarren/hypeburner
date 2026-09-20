export function articleUrl(publicSiteUrl: string, contentPath: string): string {
  const origin = new URL(publicSiteUrl).origin
  const path = contentPath.split(/[?#]/, 1)[0].replace(/^\/+/, '')
  return `${origin}/${path}`
}
