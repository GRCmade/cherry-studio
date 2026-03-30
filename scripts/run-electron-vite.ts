import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'

const electronViteCli = join(dirname(require.resolve('electron-vite')), 'cli.js')
const env = { ...process.env }

delete env.ELECTRON_RUN_AS_NODE

const child = spawn(process.execPath, [electronViteCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
