import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { ddb, TABLE_NAME, keys, gsi1 } from '../db/client';
import { Director } from '../types';

function toDirector(item: Record<string, unknown>): Director {
  const { PK, SK, GSI1PK, GSI1SK, entityType, ...rest } = item;
  return rest as unknown as Director;
}

export interface CreateDirectorInput {
  name: string;
  bornYear?: number;
  nationality?: string;
}

export const directorRepository = {
  async create(input: CreateDirectorInput): Promise<Director> {
    const id = ulid();
    const now = new Date().toISOString();
    const director: Director = { id, createdAt: now, updatedAt: now, ...input };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...keys.director(id),
          ...gsi1.director(input.name),
          entityType: 'DIRECTOR',
          ...director
        },
        ConditionExpression: 'attribute_not_exists(PK)'
      })
    );
    return director;
  },

  async getById(id: string): Promise<Director | null> {
    const result = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: keys.director(id) })
    );
    return result.Item ? toDirector(result.Item) : null;
  },

  async list(limit = 50): Promise<Director[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'ENTITY#DIRECTOR' },
        Limit: limit
      })
    );
    return (result.Items ?? []).map(toDirector);
  },

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: keys.director(id) }));
    return true;
  }
};
