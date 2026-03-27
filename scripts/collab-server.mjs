import { Server } from '@hocuspocus/server'

const port = Number(process.env.COLLAB_PORT || 1234)
const address = process.env.COLLAB_HOST || '127.0.0.1'

const server = new Server({
  port,
  address,
})

await server.listen()

console.log(`\n[collab] websocket ready at ws://${address}:${port}`)
console.log('[collab] open two browser tabs, edit /, and click "连接协同" in both tabs.\n')
