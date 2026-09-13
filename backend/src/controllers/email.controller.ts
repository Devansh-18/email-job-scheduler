import crypto from 'crypto';
import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { emailQueue } from '../queues/email.queue';
import { AuthRequest } from '../middleware/auth.middleware';

const ScheduleEmailSchema = z.object({
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  bodyText: z.string().min(1, 'Body text is required'),
  bodyHtml: z.string().optional(),
  startTime: z.string().datetime({ offset: true }).or(z.string()),
  minDelayBetweenSends: z.number().int().min(0).optional(),
  maxEmailsPerHour: z.number().int().min(1).optional(),
});

export const scheduleEmailsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = ScheduleEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const {
      senderId,
      recipients,
      subject,
      bodyText,
      bodyHtml,
      startTime,
      minDelayBetweenSends,
      maxEmailsPerHour,
    } = parseResult.data;

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify sender exists (senders are shared SMTP accounts)
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const batchId = crypto.randomUUID();
    const scheduledDate = new Date(startTime);
    const delay = Math.max(0, scheduledDate.getTime() - Date.now());

    // Wrap record creation in transaction — each email is owned by the authenticated user
    const createdEmails = await prisma.$transaction(
      recipients.map((recipient) =>
        prisma.email.create({
          data: {
            senderId,
            userId,
            batchId,
            recipient,
            subject,
            bodyText,
            bodyHtml: bodyHtml || null,
            status: 'SCHEDULED',
            scheduledAt: scheduledDate,
            maxEmailsPerHour: maxEmailsPerHour !== undefined ? maxEmailsPerHour : null,
            minDelayBetweenSends: minDelayBetweenSends !== undefined ? minDelayBetweenSends : null,
          },
        })
      )
    );

    // Prepare BullMQ bulk jobs with matching jobIds
    const bulkJobs = createdEmails.map((email) => ({
      name: 'dispatch-email',
      data: { emailId: email.id },
      opts: {
        jobId: email.id,
        delay,
      },
    }));

    await emailQueue.addBulk(bulkJobs);

    // Update bullJobId on email records
    await prisma.$transaction(
      createdEmails.map((email) =>
        prisma.email.update({
          where: { id: email.id },
          data: { bullJobId: email.id },
        })
      )
    );

    return res.status(201).json({
      message: `Successfully scheduled ${createdEmails.length} email(s)`,
      count: createdEmails.length,
      emails: createdEmails,
    });
  } catch (err: any) {
    console.error('Schedule Emails Error:', err);
    return res.status(500).json({ error: 'Internal Server Error scheduling emails' });
  }
};

export const getScheduledEmailsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const scheduledEmails = await prisma.email.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING', 'RESCHEDULED'] },
      },
      include: {
        sender: {
          select: { name: true, email: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return res.json({ count: scheduledEmails.length, data: scheduledEmails });
  } catch (err: any) {
    console.error('Get Scheduled Emails Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSentEmailsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sentEmails = await prisma.email.findMany({
      where: {
        userId,
        status: { in: ['SENT', 'FAILED'] },
      },
      include: {
        sender: {
          select: { name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ count: sentEmails.length, data: sentEmails });
  } catch (err: any) {
    console.error('Get Sent Emails Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSendersHandler = async (req: AuthRequest, res: Response) => {
  try {
    // Senders are shared SMTP accounts — all authenticated users can use any sender
    const senders = await prisma.sender.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        maxEmailsPerHour: true,
        minDelayBetweenSends: true,
      },
    });

    return res.json({ data: senders });
  } catch (err: any) {
    console.error('Get Senders Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
