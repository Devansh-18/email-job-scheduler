import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import { ReconciliationService } from './services/reconcile.service';
import './workers/email.worker'; // Import worker so it starts with the server process

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/emails', emailRoutes);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Boot-time crash recovery & server launch
const startServer = async () => {
  try {
    console.log('[Server] Starting ReachInbox Email Job Scheduler Server...');

    // Run reconciliation on Express startup
    await ReconciliationService.reconcileOrphanedJobs();

    app.listen(PORT, () => {
      console.log(`[Server] Express server running on port ${PORT}`);
      console.log(`[Worker] BullMQ Worker listening on email-dispatch-queue with concurrency ${process.env.WORKER_CONCURRENCY || 5}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
