#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MoviesStack } from '../lib/movies-stack';

const app = new cdk.App();

new MoviesStack(app, 'MoviesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-2'
  },
  description: 'Movies app: ECS Fargate services (API + web) behind an ALB, backed by DynamoDB'
});

app.synth();
