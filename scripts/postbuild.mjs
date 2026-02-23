import rss from './rss.mjs'

async function postbuild() {
  await rss()
}

postbuild()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
