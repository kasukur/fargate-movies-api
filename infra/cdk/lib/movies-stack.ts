import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class MoviesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------
    // DynamoDB: single table, two GSIs
    // ---------------------------------------------------------------
    const table = new dynamodb.Table(this, 'MoviesTable', {
      tableName: 'MoviesApp',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // ---------------------------------------------------------------
    // Networking: VPC with public + private subnets across 2 AZs
    // ---------------------------------------------------------------
    const vpc = new ec2.Vpc(this, 'MoviesVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        }
      ]
    });

    // Keep DynamoDB traffic on the AWS backbone instead of the NAT gateway.
    vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB
    });

    const cluster = new ecs.Cluster(this, 'MoviesCluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED
    });

    // ---------------------------------------------------------------
    // IAM: task role scoped to exactly what the API needs
    // ---------------------------------------------------------------
    const apiTaskRole = new iam.Role(this, 'ApiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Task role for the Movies API - DynamoDB access only'
    });

    apiTaskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'MoviesTableReadWrite',
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:TransactWriteItems',
          'dynamodb:BatchWriteItem',
          'dynamodb:ConditionCheckItem'
        ],
        resources: [table.tableArn, `${table.tableArn}/index/*`]
      })
    );

    // ---------------------------------------------------------------
    // Container images
    //
    // The build context is the REPO ROOT for both images, not apps/<name>.
    // npm workspaces keeps a single package-lock.json at the root, so `npm ci`
    // inside a workspace folder has no lockfile to install from. `exclude`
    // keeps each image's asset hash from churning when the other app changes,
    // and keeps infra/ (which holds cdk.out) out of the staged context.
    // ---------------------------------------------------------------
    const repoRoot = path.join(__dirname, '..', '..', '..');

    const apiImage = new ecrAssets.DockerImageAsset(this, 'ApiImage', {
      directory: repoRoot,
      file: path.join('apps', 'api', 'Dockerfile'),
      platform: ecrAssets.Platform.LINUX_AMD64,
      exclude: ['apps/web', 'tests', 'infra']
    });

    const webImage = new ecrAssets.DockerImageAsset(this, 'WebImage', {
      directory: repoRoot,
      file: path.join('apps', 'web', 'Dockerfile'),
      platform: ecrAssets.Platform.LINUX_AMD64,
      exclude: ['apps/api', 'tests', 'infra']
    });

    // ---------------------------------------------------------------
    // API service
    // ---------------------------------------------------------------
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole: apiTaskRole
    });

    apiTaskDef.addContainer('api', {
      image: ecs.ContainerImage.fromDockerImageAsset(apiImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup: apiLogGroup }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        TABLE_NAME: table.tableName,
        AWS_REGION: this.region
      },
      portMappings: [{ containerPort: 3000 }]
    });

    const apiService = new ecs.FargateService(this, 'ApiService', {
      cluster,
      taskDefinition: apiTaskDef,
      desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
    });

    const apiScaling = apiService.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 6 });
    apiScaling.scaleOnCpuUtilization('ApiCpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    // ---------------------------------------------------------------
    // Web service
    // ---------------------------------------------------------------
    const webLogGroup = new logs.LogGroup(this, 'WebLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const webTaskDef = new ecs.FargateTaskDefinition(this, 'WebTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512
    });

    webTaskDef.addContainer('web', {
      image: ecs.ContainerImage.fromDockerImageAsset(webImage),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'web', logGroup: webLogGroup }),
      portMappings: [{ containerPort: 80 }]
    });

    const webService = new ecs.FargateService(this, 'WebService', {
      cluster,
      taskDefinition: webTaskDef,
      desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
    });

    // ---------------------------------------------------------------
    // ALB: /api/* -> API service, everything else -> web service
    // ---------------------------------------------------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, 'MoviesAlb', {
      vpc,
      internetFacing: true
    });

    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: true
    });

    listener.addTargets('WebTargets', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [webService],
      healthCheck: {
        path: '/healthz',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3
      },
      deregistrationDelay: cdk.Duration.seconds(15)
    });

    listener.addTargets('ApiTargets', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/health'])],
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [apiService],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3
      },
      deregistrationDelay: cdk.Duration.seconds(15)
    });

    // ---------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'Public URL of the application'
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name'
    });
  }
}
