import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  THUMBNAILS_DIR,
  builderInvocation,
  readManifest,
  resolvePhotosDir,
  syncPublicPhotos,
} from './admin-files'
import { addAdminLog, echoAdminLog } from './admin-log'
import { MONOREPO_ROOT_PATH } from './__internal__/constants'

export type RebuildJobStatus = 'running' | 'success' | 'error'

export interface RebuildJobLog {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface RebuildJob {
  id: string
  kind: 'rebuild'
  status: RebuildJobStatus
  progress: number
  message: string
  logs: RebuildJobLog[]
  startedAt: string
  finishedAt?: string
  error?: string
}

const jobs = new Map<string, RebuildJob>()
let activeJobId: string | null = null
let jobCounter = 0

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif'])
const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g

function countPhotos(dir: string): number {
  let total = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
        continue
      }
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        total += countPhotos(fullPath)
      }
      else if (entry.isFile() && PHOTO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        total += 1
      }
    }
  }
  catch {
    return total
  }
  return total
}

function countThumbnails(): number {
  try {
    return fs.readdirSync(THUMBNAILS_DIR).filter(name => /\.(?:jpe?g|png|webp|avif)$/i.test(name)).length
  }
  catch {
    return 0
  }
}

function stripAnsi(value: string): string {
  return value.replaceAll(ANSI_ESCAPE, '')
}

function snapshot(job: RebuildJob): RebuildJob {
  return { ...job, logs: job.logs.map(item => ({ ...item })) }
}

function pushJobLog(job: RebuildJob, level: RebuildJobLog['level'], raw: string): void {
  const line = stripAnsi(raw).replaceAll(/\s+/g, ' ').trim()
  if (!line) {
    return
  }
  const at = new Date().toISOString()
  const message = line.slice(0, 500)
  job.logs.push({ at, level, message })
  if (job.logs.length > 240) {
    job.logs.splice(0, job.logs.length - 240)
  }
  echoAdminLog({ at, level, scope: 'build', message })
  if (level === 'error' || level === 'warn' || /完成|失败|找到 \d+ 张|开始|Manifest/.test(line)) {
    addAdminLog({ at, scope: 'build', level, message }, { echo: false })
  }
}

function finishJob(
  job: RebuildJob,
  status: Exclude<RebuildJobStatus, 'running'>,
  message: string,
  error?: string,
): void {
  if (job.status !== 'running') {
    return
  }
  job.status = status
  job.message = message
  job.finishedAt = new Date().toISOString()
  job.error = error
  if (status === 'success') {
    job.progress = 100
  }
  addAdminLog({
    scope: 'build',
    level: status === 'success' ? 'success' : 'error',
    message,
  })
}

export function startRebuildJob(basePath?: string): RebuildJob {
  if (activeJobId) {
    const active = jobs.get(activeJobId)
    if (active?.status === 'running') {
      return snapshot(active)
    }
  }

  const photosDir = resolvePhotosDir(basePath)
  const total = countPhotos(photosDir)
  const manifestCount = readManifest()?.data.length ?? 0
  const job: RebuildJob = {
    id: `rebuild-${Date.now()}-${++jobCounter}`,
    kind: 'rebuild',
    status: 'running',
    progress: 3,
    message: total > 0 ? `已发现 ${total} 张照片，正在启动索引…` : '照片目录为空，正在刷新清单…',
    logs: [],
    startedAt: new Date().toISOString(),
  }
  jobs.set(job.id, job)
  activeJobId = job.id
  addAdminLog({
    scope: 'build',
    level: 'info',
    message: `开始索引照片：目录 ${path.relative(process.cwd(), photosDir) || photosDir}，发现 ${total} 张照片`,
  })

  const { command, args } = builderInvocation()
  let settled = false
  let child: ReturnType<typeof spawn> | null = null
  let stdoutBuffer = ''
  let stderrBuffer = ''
  let progressTimer: NodeJS.Timeout | null = null
  let timeoutTimer: NodeJS.Timeout | null = null

  const stopTimers = () => {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
      timeoutTimer = null
    }
  }

  const fail = (message: string, error?: string) => {
    if (job.status !== 'running') {
      return
    }
    finishJob(job, 'error', message, error)
    stopTimers()
  }

  const complete = async (code: number | null) => {
    if (settled) {
      return
    }
    settled = true
    stopTimers()
    if (code === 0) {
      job.progress = Math.max(job.progress, 96)
      job.message = '正在同步公开照片…'
      try {
        await syncPublicPhotos(photosDir)
      }
      catch (error) {
        pushJobLog(job, 'error', `同步公开照片失败：${(error as Error).message}`)
        finishJob(job, 'error', '索引完成，但同步公开照片失败', (error as Error).message)
        return
      }
      const count = readManifest()?.data.length ?? total
      finishJob(job, 'success', `索引完成，共 ${count} 张照片`)
    }
    else {
      finishJob(job, 'error', `索引失败（退出码 ${code ?? 'unknown'}）`)
    }
  }

  try {
    child = spawn(command, args, {
      cwd: MONOREPO_ROOT_PATH,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    fail(`无法启动索引进程：${(error as Error).message}`, (error as Error).message)
    return snapshot(job)
  }

  const consume = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
    const text = chunk.toString('utf8')
    if (stream === 'stdout') {
      stdoutBuffer += text
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        pushJobLog(job, 'info', line)
      }
    }
    else {
      stderrBuffer += text
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() ?? ''
      for (const line of lines) {
        pushJobLog(job, /error|failed|失败/i.test(line) ? 'error' : 'warn', line)
      }
    }
  }

  child.stdout?.on('data', (chunk: Buffer) => consume(chunk, 'stdout'))
  child.stderr?.on('data', (chunk: Buffer) => consume(chunk, 'stderr'))
  child.on('error', (error) => {
    fail(`索引进程启动失败：${error.message}`, error.message)
    settled = true
    stopTimers()
  })
  child.on('close', (code) => {
    if (stdoutBuffer.trim()) {
      pushJobLog(job, 'info', stdoutBuffer)
    }
    if (stderrBuffer.trim()) {
      pushJobLog(job, 'warn', stderrBuffer)
    }
    void complete(code)
  })

  job.progress = total > 0 ? Math.min(12, 3 + Math.round(total / 100)) : 8
  job.message = total > 0 ? `正在处理 0/${total} 张照片…` : '正在刷新清单…'

  progressTimer = setInterval(() => {
    if (job.status !== 'running' || total <= 0) {
      return
    }
    const thumbnails = Math.min(total, countThumbnails())
    const completed = Math.max(0, Math.min(total, Math.max(manifestCount, thumbnails)))
    const progress = Math.min(94, 8 + Math.round((completed / total) * 86))
    job.progress = Math.max(job.progress, progress)
    job.message = `正在生成缩略图 ${completed}/${total} 张…`
  }, 450)

  timeoutTimer = setTimeout(() => {
    if (job.status !== 'running') {
      return
    }
    child?.kill()
    settled = true
    fail('索引超时（10 分钟），已停止进程', 'timeout')
  }, 10 * 60 * 1000)

  return snapshot(job)
}

export function getRebuildJob(id: string): RebuildJob | undefined {
  const job = jobs.get(id)
  return job ? snapshot(job) : undefined
}

export function getActiveRebuildJob(): RebuildJob | undefined {
  if (!activeJobId) {
    return undefined
  }
  const job = jobs.get(activeJobId)
  return job ? snapshot(job) : undefined
}
