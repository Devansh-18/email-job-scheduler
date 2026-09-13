import { redisConnection } from '../config/redis';

export class RateLimitService {
  public static getHourKey(prefix: 'sender' | 'batch', id: string, date: Date = new Date()): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `ratelimit:${prefix}:${id}:${yyyy}-${mm}-${dd}-${hh}`;
  }

  public static async checkAndIncrement(
    senderId: string,
    globalSenderLimit: number,
    batchId?: string | null,
    batchLimit?: number | null
  ): Promise<{ allowed: boolean; delayMs?: number; reason?: string }> {
    const now = new Date();
    const senderKey = this.getHourKey('sender', senderId, now);
    const hasBatchCheck = Boolean(batchId && batchLimit && batchLimit > 0);
    const batchKey = hasBatchCheck ? this.getHourKey('batch', batchId!, now) : null;

    const pipeline = redisConnection.pipeline();
    pipeline.incr(senderKey);
    pipeline.ttl(senderKey);

    if (batchKey) {
      pipeline.incr(batchKey);
      pipeline.ttl(batchKey);
    }

    const results = await pipeline.exec();

    if (!results) {
      return { allowed: true };
    }

    const senderCount = (results[0][1] as number) || 1;
    const senderTtl = (results[1][1] as number) || -1;

    if (senderTtl === -1) {
      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
      const secondsUntilNextHour = Math.max(1, Math.ceil((nextHour.getTime() - now.getTime()) / 1000));
      await redisConnection.expire(senderKey, secondsUntilNextHour);
    }

    let batchCount = 0;
    if (batchKey && results.length >= 4) {
      batchCount = (results[2][1] as number) || 1;
      const batchTtl = (results[3][1] as number) || -1;
      if (batchTtl === -1) {
        const nextHour = new Date(now);
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
        const secondsUntilNextHour = Math.max(1, Math.ceil((nextHour.getTime() - now.getTime()) / 1000));
        await redisConnection.expire(batchKey, secondsUntilNextHour);
      }
    }

    const isSenderExceeded = senderCount > globalSenderLimit;
    const isBatchExceeded = hasBatchCheck && batchCount > (batchLimit || Infinity);

    if (isSenderExceeded || isBatchExceeded) {
      // Revert increments
      const decrPipeline = redisConnection.pipeline();
      decrPipeline.decr(senderKey);
      if (batchKey) {
        decrPipeline.decr(batchKey);
      }
      await decrPipeline.exec();

      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
      const msUntilNextHour = Math.max(1000, nextHour.getTime() - now.getTime());
      const jitter = Math.floor(Math.random() * 5000);
      const delayMs = msUntilNextHour + jitter;

      return {
        allowed: false,
        delayMs,
        reason: isSenderExceeded ? 'sender_global_limit_exceeded' : 'batch_limit_exceeded',
      };
    }

    return { allowed: true };
  }
}

