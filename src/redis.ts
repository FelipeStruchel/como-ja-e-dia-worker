// como-ja-e-dia-worker/src/redis.ts
import { Redis } from 'ioredis'
import { config } from './config.js'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      host: config.redisHost,
      port: config.redisPort,
    })
    _redis.on('error', (err: Error) => {
      console.error('[redis]', err.message)
    })
  }
  return _redis
}
