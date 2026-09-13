import { prisma } from '../config/db';
import { RateLimitService } from '../services/ratelimit.service';
import { ThrottleService } from '../services/throttle.service';
import { ReconciliationService } from '../services/reconcile.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';

async function runAcceptanceTests() {
  console.log('=== STARTING AUTOMATED ACCEPTANCE TESTS ===\n');

  try {
    // 1. Fetch default seeded Sender
    const sender = await prisma.sender.findFirst();
    if (!sender) {
      throw new Error('No sender found. Please run seed script first.');
    }
    console.log(`[Test Setup] Found Sender: ${sender.email} (ID: ${sender.id})`);

    // 2. Global & Batch Rate Limiting Test
    console.log('\n--- 1. Testing Rate Limiting & Rescheduling Logic ---');
    const senderHourKey = RateLimitService.getHourKey('sender', sender.id);
    const batchHourKey = RateLimitService.getHourKey('batch', 'test-batch-1');
    await redisConnection.del(senderHourKey);
    await redisConnection.del(batchHourKey);

    console.log('Testing Batch Isolated Limit (Allow 2/hr for test-batch-1 with Global Ceiling 10/hr)...');
    const batchResults = [];
    for (let i = 1; i <= 4; i++) {
      const check = await RateLimitService.checkAndIncrement(sender.id, 10, 'test-batch-1', 2);
      batchResults.push({ emailIndex: i, allowed: check.allowed, reason: check.reason });
    }

    const batchAllowed = batchResults.filter((r) => r.allowed).length;
    const batchBlocked = batchResults.filter((r) => !r.allowed).length;
    console.log(`Batch Limit Results (4 emails): Allowed ${batchAllowed} (Expected 2), Blocked ${batchBlocked} (Expected 2)`);

    if (batchAllowed !== 2 || batchBlocked !== 2) {
      throw new Error(`Batch rate limit test failed: expected 2 allowed and 2 blocked, got ${batchAllowed} allowed and ${batchBlocked} blocked.`);
    }

    console.log('\nTesting Global Sender Limit (Allow max 3/hr globally across all batches)...');
    // Global sender counter is currently at 2 (from batch 1). Batch 2 tries sending 2 emails.
    const batch2HourKey = RateLimitService.getHourKey('batch', 'test-batch-2');
    await redisConnection.del(batch2HourKey);

    const globalResults = [];
    for (let i = 1; i <= 3; i++) {
      const check = await RateLimitService.checkAndIncrement(sender.id, 3, 'test-batch-2', 10);
      globalResults.push({ emailIndex: i, allowed: check.allowed, reason: check.reason });
    }

    const globalAllowed = globalResults.filter((r) => r.allowed).length;
    const globalBlocked = globalResults.filter((r) => !r.allowed).length;
    console.log(`Global Limit Results (3 emails from Batch 2): Allowed ${globalAllowed} (Expected 1), Blocked ${globalBlocked} (Expected 2)`);

    if (globalAllowed !== 1 || globalBlocked !== 2) {
      throw new Error(`Global rate limit test failed: expected 1 allowed and 2 blocked, got ${globalAllowed} allowed and ${globalBlocked} blocked.`);
    }

    console.log('✔ Global & Batch Rate Limiting & Rescheduling Test PASSED');

    // 3. Multi-Send Throttle Test
    console.log('\n--- 2. Testing Inter-Send Throttle Timing ---');
    const minDelaySec = 2;
    const t0 = Date.now();
    await ThrottleService.applyThrottle(sender.id, minDelaySec);
    const t1 = Date.now();
    await ThrottleService.applyThrottle(sender.id, minDelaySec);
    const t2 = Date.now();

    const elapsedMs = t2 - t1;
    console.log(`First send timestamp: ${t1}ms`);
    console.log(`Second send timestamp: ${t2}ms`);
    console.log(`Elapsed between sends: ${elapsedMs}ms (Expected >= 2000ms)`);

    if (elapsedMs < 1900) {
      throw new Error(`Throttle timing test failed: elapsed ${elapsedMs}ms is less than 2000ms.`);
    }
    console.log('✔ Inter-Send Throttle Test PASSED');

    // 4. Server Crash & Job Reconciliation Test
    console.log('\n--- 3. Testing Crash Recovery & Job Reconciliation ---');
    const futureTime = new Date(Date.now() + 120000); // 2 minutes from now
    const mockEmail = await prisma.email.create({
      data: {
        senderId: sender.id,
        recipient: 'crash-recovery-test@reachinbox.ai',
        subject: 'Crash Test Email',
        bodyText: 'Testing crash recovery',
        status: 'SCHEDULED',
        scheduledAt: futureTime,
      },
    });

    console.log(`Created mock DB record ${mockEmail.id} with status SCHEDULED without BullMQ job.`);
    let jobInQueue = await emailQueue.getJob(mockEmail.id);
    console.log(`BullMQ job exists prior to reconciliation: ${!!jobInQueue}`);

    // Trigger reconciliation (simulating server boot recovery)
    await ReconciliationService.reconcileOrphanedJobs();

    jobInQueue = await emailQueue.getJob(mockEmail.id);
    console.log(`BullMQ job exists after reconciliation: ${!!jobInQueue}`);

    if (!jobInQueue) {
      throw new Error('Reconciliation test failed: job was not re-added to BullMQ queue.');
    }

    // Cleanup test record
    await prisma.email.delete({ where: { id: mockEmail.id } });
    console.log('✔ Crash Recovery & Job Reconciliation Test PASSED');

    console.log('\n=============================================');
    console.log('🎉 ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================\n');
  } catch (err: any) {
    console.error('\n❌ ACCEPTANCE TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await emailQueue.close();
    await redisConnection.quit();
  }
}

runAcceptanceTests();
