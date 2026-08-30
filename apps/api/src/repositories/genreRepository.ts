import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { ddb, TABLE_NAME, keys, gsi1 } from '../db/client';
import { Genre } from '../types';

function toGenre(item: Record<string, unknown>): Genre {
  const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = item;
  return rest as unknown as Genre;
}

export interface CreateGenreInput {
  name: string;
  description?: string;
}

export const genreRepository = {
  async create(input: CreateGenreInput): Promise<Genre> {
    const id = ulid();
    const now = new Date().toISOString();
    const genre: Genre = { id, createdAt: now, updatedAt: now, ...input };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...keys.genre(id),
          ...gsi1.genre(input.name),
          entityType: 'GENRE',
          ...genre
        },
        ConditionExpression: 'attribute_not_exists(PK)'
      })
    );
    return genre;
  },

  async getById(id: string): Promise<Genre | null> {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: keys.genre(id) })
    );
    return result.Item ? toGenre(result.Item) : null;
  },

  async list(limit = 50): Promise<Genre[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'ENTITY#GENRE' },
        Limit: limit
      })
    );
    return (result.Items ?? []).map(toGenre);
  },

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: keys.genre(id) }));
    return true;
  }
};
