import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { ddb, TABLE_NAME, keys, gsi1, gsi2 } from '../db/client';
import { Movie, PagedResult } from '../types';

interface MovieItem extends Movie {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  entityType: 'MOVIE';
}

function toMovie(item: Record<string, unknown>): Movie {
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, entityType, ...rest } = item as unknown as MovieItem;
  return rest as Movie;
}

function encodeCursor(key?: Record<string, unknown>): string | undefined {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function decodeCursor(cursor?: string): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
}

export interface CreateMovieInput {
  title: string;
  year: number;
  directorId: string;
  genreIds: string[];
  synopsis?: string;
  rating?: number;
}

export interface UpdateMovieInput {
  synopsis?: string;
  rating?: number;
}

export const movieRepository = {
  async create(input: CreateMovieInput): Promise<Movie> {
    const id = ulid();
    const now = new Date().toISOString();
    const movie: Movie = { id, createdAt: now, updatedAt: now, ...input };

    const item: MovieItem = {
      ...keys.movie(id),
      ...gsi1.movie(input.title),
      ...gsi2.movieByDirector(input.directorId, input.year, id),
      entityType: 'MOVIE',
      ...movie
    };

    // The movie item plus one adjacency item per genre, written atomically.
    const transactItems = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK)'
        }
      },
      ...input.genreIds.map((genreId) => ({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...keys.genreMembership(genreId, id),
            entityType: 'GENRE_MEMBERSHIP',
            movieId: id,
            genreId,
            title: input.title,
            year: input.year
          }
        }
      }))
    ];

    await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
    return movie;
  },

  async getById(id: string): Promise<Movie | null> {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: keys.movie(id) })
    );
    return result.Item ? toMovie(result.Item) : null;
  },

  async list(limit = 25, cursor?: string): Promise<PagedResult<Movie>> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'ENTITY#MOVIE' },
        Limit: limit,
        ExclusiveStartKey: decodeCursor(cursor)
      })
    );
    return {
      items: (result.Items ?? []).map(toMovie),
      nextCursor: encodeCursor(result.LastEvaluatedKey)
    };
  },

  async searchByTitlePrefix(prefix: string, limit = 25): Promise<Movie[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': 'ENTITY#MOVIE',
          ':prefix': `TITLE#${prefix.toLowerCase()}`
        },
        Limit: limit
      })
    );
    return (result.Items ?? []).map(toMovie);
  },

  async listByDirector(directorId: string, limit = 25): Promise<Movie[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `DIRECTOR#${directorId}` },
        Limit: limit
      })
    );
    return (result.Items ?? []).map(toMovie);
  },

  async listByGenre(genreId: string, limit = 25): Promise<{ movieId: string; title: string; year: number }[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `GENRE#${genreId}`,
          ':sk': 'MOVIE#'
        },
        Limit: limit
      })
    );
    return (result.Items ?? []).map((item) => ({
      movieId: item.movieId as string,
      title: item.title as string,
      year: item.year as number
    }));
  },

  async update(id: string, input: UpdateMovieInput): Promise<Movie | null> {
    const setClauses: string[] = ['updatedAt = :updatedAt'];
    const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

    if (input.synopsis !== undefined) {
      setClauses.push('synopsis = :synopsis');
      values[':synopsis'] = input.synopsis;
    }
    if (input.rating !== undefined) {
      setClauses.push('rating = :rating');
      values[':rating'] = input.rating;
    }

    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: keys.movie(id),
          UpdateExpression: `SET ${setClauses.join(', ')}`,
          ExpressionAttributeValues: values,
          ConditionExpression: 'attribute_exists(PK)',
          ReturnValues: 'ALL_NEW'
        })
      );
      return result.Attributes ? toMovie(result.Attributes) : null;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        return null;
      }
      throw err;
    }
  },

  async delete(id: string): Promise<boolean> {
    const movie = await this.getById(id);
    if (!movie) return false;

    const transactItems = [
      { Delete: { TableName: TABLE_NAME, Key: keys.movie(id) } },
      ...movie.genreIds.map((genreId) => ({
        Delete: { TableName: TABLE_NAME, Key: keys.genreMembership(genreId, id) }
      }))
    ];

    await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
    return true;
  }
};
