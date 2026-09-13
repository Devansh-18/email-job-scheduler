import { redisConnection } from '../config/redis';

export class ThrottleService {
  public static async applyThrottle(senderId: string, minDelayBetweenSendsSec: number): Promise<void> {
    if (minDelayBetweenSendsSec <= 0) return;

    const key = `last_send:sender:${senderId}`;
    const minDelayMs = minDelayBetweenSendsSec * 1000;
    const lastSendStr = await redisConnection.get(key);
    const now = Date.now();

    if (lastSendStr) {
      const lastSendTime = parseInt(lastSendStr, 10);
      const elapsed = now - lastSendTime;
      if (elapsed < minDelayMs) {
        const waitMs = minDelayMs - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    await redisConnection.set(key, Date.now().toString(), 'PX', minDelayMs * 10);
  }
}
