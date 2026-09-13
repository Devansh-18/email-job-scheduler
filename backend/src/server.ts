import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import { ReconciliationService } from './services/reconcile.service';
import './workers/email.worker'; // Import worker so it starts with the server process

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/emails', emailRoutes);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Boot server immediately binding to 0.0.0.0 for Render port detection
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Server] Express server running on 0.0.0.0:${PORT}`);
  console.log(
    `[Worker] BullMQ Worker listening on email-dispatch-queue with concurrency ${
      process.env.WORKER_CONCURRENCY || 5
    }`
  );

  try {
    console.log('[Server] Running boot-time job reconciliation...');
    await ReconciliationService.reconcileOrphanedJobs();
  } catch (err) {
    console.error('[Server] Error during boot-time reconciliation:', err);
  }
});

