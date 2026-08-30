import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { moviesRouter } from './routes/movies';
import { directorsRouter } from './routes/directors';
import { genresRouter } from './routes/genres';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter);
  app.use('/api/movies', moviesRouter);
  app.use('/api/directors', directorsRouter);
  app.use('/api/genres', genresRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
