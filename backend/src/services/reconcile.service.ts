import { prisma } from '../config/db';
import { emailQueue } from '../queues/email.queue';

export class ReconciliationService {
  public static async reconcileOrphanedJobs(): Promise<void> {
    console.log('[Reconciliation] Checking for orphaned email jobs in database...');
    
    const pendingEmails = await prisma.email.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED'] },
      },
    });

    let readdedCount = 0;

    for (const record of pendingEmails) {
      const existingJob = await emailQueue.getJob(record.id);

      if (!existingJob) {
        const delay = Math.max(0, new Date(record.scheduledAt).getTime() - Date.now());
        await emailQueue.add(
          'dispatch-email',
          { emailId: record.id },
          {
            jobId: record.id,
            delay,
          }
        );

        await prisma.email.update({
          where: { id: record.id },
          data: { bullJobId: record.id },
        });

        readdedCount++;
      }
    }

    console.log(`[Reconciliation] Complete. Re-enqueued ${readdedCount} orphaned jobs out of ${pendingEmails.length} pending records.`);
  }
}
