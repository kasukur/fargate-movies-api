import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { genreRepository } from '../repositories/genreRepository';
import { movieRepository } from '../repositories/movieRepository';

const createGenreSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional()
});

export const genresRouter = Router();

genresRouter.get('/', async (_req, res, next) => {
  try {
    const items = await genreRepository.list();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

genresRouter.get('/:id', async (req, res, next) => {
  try {
    const genre = await genreRepository.getById(req.params.id);
    if (!genre) throw new HttpError(404, `Genre ${req.params.id} not found`);
    res.json(genre);
  } catch (err) {
    next(err);
  }
});

genresRouter.get('/:id/movies', async (req, res, next) => {
  try {
    const genre = await genreRepository.getById(req.params.id);
    if (!genre) throw new HttpError(404, `Genre ${req.params.id} not found`);
    const items = await movieRepository.listByGenre(req.params.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

genresRouter.post('/', validateBody(createGenreSchema), async (req, res, next) => {
  try {
    const genre = await genreRepository.create(req.body);
    res.status(201).json(genre);
  } catch (err) {
    next(err);
  }
});

genresRouter.delete('/:id', async (req, res, next) => {
  try {
    const movies = await movieRepository.listByGenre(req.params.id, 1);
    if (movies.length > 0) {
      throw new HttpError(409, 'Cannot delete a genre that still has movies');
    }
    const deleted = await genreRepository.delete(req.params.id);
    if (!deleted) throw new HttpError(404, `Genre ${req.params.id} not found`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
