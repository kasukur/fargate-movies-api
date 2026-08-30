import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { directorRepository } from '../repositories/directorRepository';
import { movieRepository } from '../repositories/movieRepository';

const createDirectorSchema = z.object({
  name: z.string().min(1).max(120),
  bornYear: z.number().int().min(1850).max(2020).optional(),
  nationality: z.string().max(80).optional()
});

export const directorsRouter = Router();

directorsRouter.get('/', async (_req, res, next) => {
  try {
    const items = await directorRepository.list();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

directorsRouter.get('/:id', async (req, res, next) => {
  try {
    const director = await directorRepository.getById(req.params.id);
    if (!director) throw new HttpError(404, `Director ${req.params.id} not found`);
    res.json(director);
  } catch (err) {
    next(err);
  }
});

directorsRouter.get('/:id/movies', async (req, res, next) => {
  try {
    const director = await directorRepository.getById(req.params.id);
    if (!director) throw new HttpError(404, `Director ${req.params.id} not found`);
    const items = await movieRepository.listByDirector(req.params.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

directorsRouter.post('/', validateBody(createDirectorSchema), async (req, res, next) => {
  try {
    const director = await directorRepository.create(req.body);
    res.status(201).json(director);
  } catch (err) {
    next(err);
  }
});

directorsRouter.delete('/:id', async (req, res, next) => {
  try {
    const movies = await movieRepository.listByDirector(req.params.id, 1);
    if (movies.length > 0) {
      throw new HttpError(409, 'Cannot delete a director who still has movies');
    }
    const deleted = await directorRepository.delete(req.params.id);
    if (!deleted) throw new HttpError(404, `Director ${req.params.id} not found`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
