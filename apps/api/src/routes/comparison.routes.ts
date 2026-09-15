import { Router } from 'express';
import { compareProducts } from '../controllers/comparison.controller';

const router = Router();

router.post('/', compareProducts);

export default router;
