import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '../config';

const baseClient = new DynamoDBClient({
  region: config.region,
  ...(config.dynamoDbEndpoint ? { endpoint: config.dynamoDbEndpoint } : {})
});

export const ddb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

export const TABLE_NAME = config.tableName;

/**
 * Single-table design key builders.
 *
 * Entity        | PK                | SK                  | GSI1PK        | GSI1SK
 * --------------|-------------------|---------------------|---------------|---------------------------
 * Movie         | MOVIE#<id>        | METADATA            | ENTITY#MOVIE  | TITLE#<lowercased title>
 * Director      | DIRECTOR#<id>     | METADATA            | ENTITY#DIRECTOR | NAME#<lowercased name>
 * Genre         | GENRE#<id>        | METADATA            | ENTITY#GENRE  | NAME#<lowercased name>
 * Movie/Genre   | GENRE#<genreId>   | MOVIE#<movieId>     | -             | -
 *
 * GSI2 (movies by director):
 * Movie         | GSI2PK=DIRECTOR#<directorId> | GSI2SK=YEAR#<zero-padded year>#MOVIE#<id>
 */
export const keys = {
  movie: (id: string) => ({ PK: `MOVIE#${id}`, SK: 'METADATA' }),
  director: (id: string) => ({ PK: `DIRECTOR#${id}`, SK: 'METADATA' }),
  genre: (id: string) => ({ PK: `GENRE#${id}`, SK: 'METADATA' }),
  genreMembership: (genreId: string, movieId: string) => ({
    PK: `GENRE#${genreId}`,
    SK: `MOVIE#${movieId}`
  })
};

export const gsi1 = {
  movie: (title: string) => ({
    GSI1PK: 'ENTITY#MOVIE',
    GSI1SK: `TITLE#${title.toLowerCase()}`
  }),
  director: (name: string) => ({
    GSI1PK: 'ENTITY#DIRECTOR',
    GSI1SK: `NAME#${name.toLowerCase()}`
  }),
  genre: (name: string) => ({
    GSI1PK: 'ENTITY#GENRE',
    GSI1SK: `NAME#${name.toLowerCase()}`
  })
};

export const gsi2 = {
  movieByDirector: (directorId: string, year: number, movieId: string) => ({
    GSI2PK: `DIRECTOR#${directorId}`,
    GSI2SK: `YEAR#${String(year).padStart(4, '0')}#MOVIE#${movieId}`
  })
};
