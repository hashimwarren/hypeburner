import rss from './rss.mjs'
import { generateCmsArtifacts } from './generate-cms-artifacts.mjs'

async function postbuild() {
  await rss()
  await generateCmsArtifacts()
}

postbuild()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
