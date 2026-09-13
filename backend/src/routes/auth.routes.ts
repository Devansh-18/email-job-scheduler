import { Router } from 'express';
import { googleAuthHandler } from '../controllers/auth.controller';

const router = Router();

router.post('/google', googleAuthHandler);

export default router;
