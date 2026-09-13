import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from '../queues/email.queue';
import { redisOptions } from '../config/redis';
import { prisma } from '../config/db';
import { RateLimitService } from '../services/ratelimit.service';
import { ThrottleService } from '../services/throttle.service';
import { MailerService } from '../services/mailer.service';

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { emailId } = job.data;

    // 1. Atomic Processing Step to prevent concurrent double execution
    const updateResult = await prisma.email.updateMany({
      where: { id: emailId, status: { in: ['SCHEDULED', 'RESCHEDULED'] } },
      data: { status: 'PROCESSING' },
    });

    if (updateResult.count === 0) {
      console.log(`[Worker] Job ${emailId} skipped (already processing or executed).`);
      return;
    }

    const emailRecord = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!emailRecord || !emailRecord.sender) {
      console.error(`[Worker] Email record or sender not found for ID: ${emailId}`);
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'FAILED', errorMessage: 'Sender record missing' },
      });
      return;
    }

    const sender = emailRecord.sender;

    // Determine global sender limit (ceiling across all batches for this sender)
    const globalSenderLimit =
      parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '', 10) ||
      sender.maxEmailsPerHour ||
      200;

    // 2. Rate Limit Enforcement (Checks both Sender Global Ceiling & Batch Isolated Limit)
    const rateCheck = await RateLimitService.checkAndIncrement(
      sender.id,
      globalSenderLimit,
      emailRecord.batchId,
      emailRecord.maxEmailsPerHour
    );

    if (!rateCheck.allowed && rateCheck.delayMs) {
      const limitReason =
        rateCheck.reason === 'sender_global_limit_exceeded'
          ? `Global Sender Hourly Limit (${globalSenderLimit}/hr)`
          : `Batch Hourly Limit (${emailRecord.maxEmailsPerHour}/hr)`;

      console.log(
        `[Worker] Sender ${sender.email} hit limit: ${limitReason}. Rescheduling job ${emailId} in ${rateCheck.delayMs}ms.`
      );

      const nextScheduledAt = new Date(Date.now() + rateCheck.delayMs);

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'RESCHEDULED',
          scheduledAt: nextScheduledAt,
        },
      });

      // Re-enqueue to BullMQ with new delay
      const newJobId = `${emailId}-rescheduled-${Date.now()}`;
      await emailQueue.add(
        'dispatch-email',
        { emailId: emailRecord.id },
        { delay: rateCheck.delayMs, jobId: newJobId }
      );

      // Do not throw an error; exit early cleanly
      return;
    }

    // 3. Inter-Send Throttle
    const effectiveMinDelay =
      emailRecord.minDelayBetweenSends !== null && emailRecord.minDelayBetweenSends !== undefined
        ? emailRecord.minDelayBetweenSends
        : sender.minDelayBetweenSends;

    await ThrottleService.applyThrottle(sender.id, effectiveMinDelay);

    // 4. Send Email via MailerService
    try {
      const smtpConfig = {
        host: sender.smtpHost,
        port: sender.smtpPort,
        user: sender.smtpUser,
        pass: sender.smtpPass,
        fromName: sender.name,
        fromEmail: sender.email,
      };

      const result = await MailerService.sendMail(
        smtpConfig,
        emailRecord.recipient,
        emailRecord.subject,
        emailRecord.bodyText,
        emailRecord.bodyHtml
      );

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      console.log(
        `[Worker] Email ${emailId} SENT to ${emailRecord.recipient}. Preview URL: ${result.previewUrl || 'N/A'}`
      );
    } catch (err: any) {
      console.error(`[Worker] Error sending email ${emailId}:`, err);

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: err?.message || 'SMTP dispatch failed',
          retryCount: { increment: 1 },
        },
      });

      throw err;
    }
  },
  {
    connection: redisOptions,
    concurrency,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
});
