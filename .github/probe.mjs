import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'
const runs = Number(process.argv[2] ?? 3)
for (let i = 0; i < runs; i++) {
  const t = performance.now()
  const s = spawn(process.execPath, ['--import', '@poppinss/ts-exec', 'bin/server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      MONGODB_URL: 'mongodb://127.0.0.1:1',
      PORT: '0',
      DMS_API_PORT: '0',
    },
  })
  const ms = await new Promise((res) => {
    let o = ''
    const c = (b) => {
      o += b
      if (o.includes('MongoServerSelectionError')) res(performance.now() - t)
    }
    s.stdout.on('data', c)
    s.stderr.on('data', c)
    s.on('close', () => res(-1))
  })
  s.kill()
  console.log(Math.round(ms))
}
