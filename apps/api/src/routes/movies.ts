import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { HttpError } from '../middleware/errorHandler';
import { movieRepository } from '../repositories/movieRepository';
import { directorRepository } from '../repositories/directorRepository';
import { genreRepository } from '../repositories/genreRepository';

const createMovieSchema = z.object({
  title: z.string().min(1).max(200),
  year: z.number().int().min(1888).max(2100),
  directorId: z.string().min(1),
  genreIds: z.array(z.string().min(1)).min(1).max(5),
  synopsis: z.string().max(2000).optional(),
  rating: z.number().min(0).max(10).optional()
});

const updateMovieSchema = z
  .object({
    synopsis: z.string().max(2000).optional(),
    rating: z.number().min(0).max(10).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
  });

export const moviesRouter = Router();

moviesRouter.get('/', async (req, res, next) => {
  try {
    const { search, directorId, genreId, limit, cursor } = req.query;
    const pageSize = Math.min(Number(limit ?? 25), 100);

    if (typeof search === 'string' && search.length > 0) {
      const items = await movieRepository.searchByTitlePrefix(search, pageSize);
      res.json({ items });
      return;
    }
    if (typeof directorId === 'string' && directorId.length > 0) {
      const items = await movieRepository.listByDirector(directorId, pageSize);
      res.json({ items });
      return;
    }
    if (typeof genreId === 'string' && genreId.length > 0) {
      const items = await movieRepository.listByGenre(genreId, pageSize);
      res.json({ items });
      return;
    }
    const page = await movieRepository.list(
      pageSize,
      typeof cursor === 'string' ? cursor : undefined
    );
    res.json(page);
  } catch (err) {
    next(err);
  }
});

moviesRouter.get('/:id', async (req, res, next) => {
  try {
    const movie = await movieRepository.getById(req.params.id);
    if (!movie) throw new HttpError(404, `Movie ${req.params.id} not found`);
    res.json(movie);
  } catch (err) {
    next(err);
  }
});

moviesRouter.post('/', validateBody(createMovieSchema), async (req, res, next) => {
  try {
    const { directorId, genreIds } = req.body;

    const director = await directorRepository.getById(directorId);
    if (!director) throw new HttpError(422, `Director ${directorId} does not exist`);

    for (const genreId of genreIds) {
      const genre = await genreRepository.getById(genreId);
      if (!genre) throw new HttpError(422, `Genre ${genreId} does not exist`);
    }

    const movie = await movieRepository.create(req.body);
    res.status(201).json(movie);
  } catch (err) {
    next(err);
  }
});

moviesRouter.put('/:id', validateBody(updateMovieSchema), async (req, res, next) => {
  try {
    const movie = await movieRepository.update(req.params.id, req.body);
    if (!movie) throw new HttpError(404, `Movie ${req.params.id} not found`);
    res.json(movie);
  } catch (err) {
    next(err);
  }
});

moviesRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await movieRepository.delete(req.params.id);
    if (!deleted) throw new HttpError(404, `Movie ${req.params.id} not found`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
