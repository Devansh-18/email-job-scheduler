import { Router } from 'express';
import {
  scheduleEmailsHandler,
  getScheduledEmailsHandler,
  getSentEmailsHandler,
  getSendersHandler,
} from '../controllers/email.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Apply JWT Authentication middleware to all email routes
router.use(authenticateJWT);

router.post('/schedule', scheduleEmailsHandler);
router.get('/scheduled', getScheduledEmailsHandler);
router.get('/sent', getSentEmailsHandler);
router.get('/senders', getSendersHandler);

export default router;
