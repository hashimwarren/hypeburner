import generatePayloadArtifacts from './generate-payload-artifacts.mjs'
import rss from './rss.mjs'

async function postbuild() {
  await generatePayloadArtifacts()
  await rss()
}

postbuild()
