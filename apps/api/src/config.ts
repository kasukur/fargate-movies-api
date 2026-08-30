export interface AppConfig {
  port: number;
  tableName: string;
  region: string;
  dynamoDbEndpoint?: string;
  corsOrigin: string;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    tableName: process.env.TABLE_NAME ?? 'MoviesApp',
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    corsOrigin: process.env.CORS_ORIGIN ?? '*'
  };
}

export const config = loadConfig();
