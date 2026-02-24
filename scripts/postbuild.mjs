import rss from './rss.mjs'
import { generateCmsArtifacts, getPublishedPosts } from './generate-cms-artifacts.mjs'

async function postbuild() {
  const posts = await getPublishedPosts()
  await rss({ posts })
  await generateCmsArtifacts({ posts })
}

postbuild()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
