# Movies on Fargate

A full-stack movies application deployed on AWS. An Express REST API backed by a single-table DynamoDB design, a Vue 3 frontend served by Nginx, both running as containers on ECS Fargate behind an Application Load Balancer, and the whole thing provisioned with AWS CDK.

## Architecture

```
                        ┌────────────────────────────────────────────┐
                        │                  AWS VPC                   │
                        │                                            │
 Internet ──────► ALB ──┤  /api/*, /health ──► ECS Fargate: API ─────┼──► DynamoDB
                        │                      (Express, port 3000)  │    (MoviesApp table
                        │                                            │     via Gateway
                        │  /* ──────────────► ECS Fargate: Web       │     VPC Endpoint)
                        │                      (Nginx, port 80)      │
                        └────────────────────────────────────────────┘
```

- **ALB path routing** – `/api/*` and `/health` go to the API target group; everything else goes to the web target group, which serves the Vue single-page app with an SPA fallback.
- **Two Fargate services** – each runs two tasks minimum in private subnets, with deployment circuit breakers and CPU-based auto scaling on the API (2–6 tasks).
- **DynamoDB** – one table, on-demand billing, point-in-time recovery, reached through a Gateway VPC Endpoint so data traffic never crosses the NAT gateway.
- **IAM** – the API task role is scoped to the specific table and its indexes with only the actions the code uses. The web container has no AWS permissions at all.

### Repository layout

```
.
├── apps/
│   ├── api/                # Express + TypeScript REST API
│   │   ├── src/
│   │   │   ├── db/         # DynamoDB client + key builders (single-table design)
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   └── middleware/
│   │   ├── scripts/        # create-table.ts, seed.ts (local development)
│   │   └── Dockerfile      # multi-stage, non-root, healthcheck
│   └── web/                # Vue 3 + Vite + Pinia + Vue Router
│       ├── src/
│       ├── nginx.conf      # production: SPA fallback, asset caching, /healthz
│       ├── nginx.local.conf# docker compose only: adds /api/* -> API proxying
│       └── Dockerfile      # multi-stage build → Nginx
├── infra/
│   └── cdk/                # AWS CDK stack (VPC, ECS, ALB, DynamoDB, IAM)
├── tests/
│   └── e2e/                # Playwright: E2E + API integration suites
├── .dockerignore           # applies to both images (context is the repo root)
├── docker-compose.yml      # local stack: DynamoDB Local + API + web
└── package.json            # npm workspaces root
```

> **Both Docker images build from the repo root**, not from `apps/api` / `apps/web`.
> npm workspaces keeps a single `package-lock.json` at the root, so `npm ci` cannot
> run from inside a workspace folder. The Dockerfiles copy the root `package.json` +
> `package-lock.json` plus their own workspace manifest and install with
> `npm ci --workspace @movies/<app>`. Build them by hand with:
>
> ```bash
> docker build -f apps/api/Dockerfile -t movies-api .
> docker build -f apps/web/Dockerfile -t movies-web .
> ```

### DynamoDB single-table design

Table `MoviesApp`, partition key `PK`, sort key `SK`, plus two GSIs.

| Entity           | PK                | SK                | GSI1PK            | GSI1SK          | GSI2PK                  | GSI2SK                   |
| ---------------- | ----------------- | ----------------- | ----------------- | --------------- | ----------------------- | ------------------------ |
| Movie            | `MOVIE#<id>`      | `METADATA`        | `ENTITY#MOVIE`    | `TITLE#<title>` | `DIRECTOR#<directorId>` | `YEAR#<year>#MOVIE#<id>` |
| Director         | `DIRECTOR#<id>`   | `METADATA`        | `ENTITY#DIRECTOR` | `NAME#<name>`   | —                       | —                        |
| Genre            | `GENRE#<id>`      | `METADATA`        | `ENTITY#GENRE`    | `NAME#<name>`   | —                       | —                        |
| Genre membership | `GENRE#<genreId>` | `MOVIE#<movieId>` | —                 | —               | —                       | —                        |

Access patterns this supports:

1. Get any entity by id → `GetItem` on `PK`/`SK`.
2. List all movies sorted by title / search by title prefix → `Query` GSI1 with `begins_with`.
3. List all directors or genres → `Query` GSI1 on the entity partition.
4. List a director's movies sorted by year → `Query` GSI2.
5. List a genre's movies → `Query` the base table on `GENRE#<id>` with `begins_with(SK, 'MOVIE#')` (adjacency items written transactionally with the movie).

IDs are ULIDs, so they are lexicographically sortable by creation time.

## Prerequisites

- Node.js ≥ 20 and npm ≥ 10
- Docker, running (DynamoDB Local, `docker compose`, and the image builds `cdk deploy` performs)
- AWS CLI configured with credentials (deployment only)
- AWS CDK bootstrapped in the target account and region — see [Bootstrap](#bootstrap-once-per-account-and-region) (deployment only)

## Local setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start DynamoDB Local
npm run db:local

# 3. Create the table and seed sample data
npm run db:create-table
npm run db:seed

# 4. Run the API (terminal 1) and the frontend (terminal 2)
npm run dev:api      # http://localhost:3000
npm run dev:web      # http://localhost:5173 (proxies /api to :3000)
```

Alternatively, run the whole stack in containers. Compose builds both images with
the repo root as the build context, so run it from the repo root:

```bash
docker compose up --build
# web:  http://localhost:8080   (also proxies /api/* and /health to the API)
# api:  http://localhost:3000   (direct)

# then create the table + seed against the container endpoint:
DYNAMODB_ENDPOINT=http://localhost:8000 npm run db:create-table
DYNAMODB_ENDPOINT=http://localhost:8000 npm run db:seed
```

In AWS the ALB routes `/api/*` and `/health` to the API service, so the production
`nginx.conf` contains no proxy block. Compose has no load balancer, so it mounts
`apps/web/nginx.local.conf` over the container's config to do that routing locally.
The image itself is byte-identical to the one that ships.

## Environment variables

### API (`apps/api`)

| Variable            | Default          | Description                                       |
| ------------------- | ---------------- | ------------------------------------------------- |
| `PORT`              | `3000`           | HTTP listen port                                  |
| `TABLE_NAME`        | `MoviesApp`      | DynamoDB table name                               |
| `AWS_REGION`        | `ap-southeast-2` | AWS region                                        |
| `DYNAMODB_ENDPOINT` | _(unset)_        | Set to `http://localhost:8000` for DynamoDB Local |
| `CORS_ORIGIN`       | `*`              | Allowed CORS origin(s)                            |

In AWS, credentials come from the ECS task role; locally, DynamoDB Local accepts any static key pair (`AWS_ACCESS_KEY_ID=local`, `AWS_SECRET_ACCESS_KEY=local`).

### Frontend (`apps/web`)

| Variable                | Default                 | Description                                                        |
| ----------------------- | ----------------------- | ------------------------------------------------------------------ |
| `VITE_API_BASE_URL`     | _(empty)_               | API origin baked in at build time. Empty = same-origin (ALB/proxy) |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Dev-server proxy target for `/api`                                 |

### Tests (`tests/e2e`)

| Variable  | Default                 | Description                                       |
| --------- | ----------------------- | ------------------------------------------------- |
| `API_URL` | `http://localhost:3000` | Backend under test. Setting it skips `webServer`. |
| `WEB_URL` | `http://localhost:5173` | Frontend under test                               |

## API reference

| Method | Path                        | Description                                                                  |
| ------ | --------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/health`                   | Liveness probe                                                               |
| GET    | `/api/movies`               | List movies (`?search=`, `?directorId=`, `?genreId=`, `?limit=`, `?cursor=`) |
| GET    | `/api/movies/:id`           | Get a movie                                                                  |
| POST   | `/api/movies`               | Create a movie (validates director/genre existence)                          |
| PUT    | `/api/movies/:id`           | Update synopsis and/or rating                                                |
| DELETE | `/api/movies/:id`           | Delete a movie and its genre adjacency items                                 |
| GET    | `/api/directors`            | List directors                                                               |
| GET    | `/api/directors/:id`        | Get a director                                                               |
| GET    | `/api/directors/:id/movies` | Movies by a director, sorted by year                                         |
| POST   | `/api/directors`            | Create a director                                                            |
| DELETE | `/api/directors/:id`        | Delete a director (409 if they still have movies)                            |
| GET    | `/api/genres`               | List genres                                                                  |
| GET    | `/api/genres/:id`           | Get a genre                                                                  |
| GET    | `/api/genres/:id/movies`    | Movies in a genre                                                            |
| POST   | `/api/genres`               | Create a genre                                                               |
| DELETE | `/api/genres/:id`           | Delete a genre (409 if it still has movies)                                  |

## Running tests

The Playwright suite lives in `tests/e2e` and orchestrates the API and Vite dev servers itself via `webServer`. Both specs create the director and genre they need through the API (the API test in a helper, the browser test in a `beforeAll` hook), so `npm run db:seed` is **not** required — DynamoDB Local just needs to be up with the table created:

```bash
npm run db:local
npm run db:create-table

# Install browsers once
npx playwright install --with-deps chromium

# Run everything (API integration + browser E2E)
npm run test:e2e

# Run one project at a time
npm run test:e2e:api          # API CRUD suite only
npm run test:e2e:browser      # browser E2E only

# Open the HTML report after a run
npm run report --workspace tests/e2e
```

> **Note:** the Playwright config lives in `tests/e2e/playwright.config.ts`. A bare
> `npx playwright test --project=api` only works from inside `tests/e2e/`; run from
> the repo root it finds no config and fails with `Project(s) "api" not found`.
> Use the root scripts above, or pass the config explicitly:
> `npx playwright test -c tests/e2e/playwright.config.ts --project=api`.

To run the same suite against a deployed environment:

```bash
API_URL=http://<alb-dns> WEB_URL=http://<alb-dns> npm run test:e2e
```

## Deployment

### Before the first deploy

- **Docker must be running.** `cdk deploy` builds both images locally, pushes them to the CDK-managed ECR repository, and then rolls the ECS services.
- **Both images build from the repo root.** The stack passes `directory: <repo root>` and `file: apps/<app>/Dockerfile` to `DockerImageAsset`; nothing is ever built from inside a workspace folder. Each asset excludes the other app, `infra/` and `tests/`, so editing the frontend does not force a rebuild of the API image.
- **On Apple Silicon** the images are built for `linux/amd64` under emulation. It works, but it is slow — see [Building on Apple Silicon](#building-on-apple-silicon).

### Bootstrap (once per account and region)

`cdk bootstrap` needs to find a CDK app, and `cdk.json` lives in `infra/cdk`, not at the repo root. Running it from the root fails with:

```
Specify an environment name like 'aws://123456789012/us-east-1', or run in a directory with 'cdk.json'.
```

Run it from the CDK directory:

```bash
cd infra/cdk
npx cdk bootstrap --profile <profile>
```

…or pass the environment explicitly, which works from any directory:

```bash
npx cdk bootstrap aws://<account-id>/ap-southeast-2 --profile <profile>
```

**Bootstrap the region you actually deploy to.** `infra/cdk/bin/app.ts` reads `CDK_DEFAULT_REGION` and falls back to `ap-southeast-2`, while a bare `cdk bootstrap` targets whatever region your profile resolves to. If those differ, the deploy fails looking for a bootstrap stack that is not there. Naming the environment explicitly removes the ambiguity.

### Deploy

```bash
# Build images, push to ECR, and create/update the stack
npm run cdk:deploy

# Review changes before deploying
cd ../..
npm run diff --workspace infra/cdk

# Tear everything down (the DynamoDB table is retained by policy)
npm run cdk:destroy
```

These root scripts run inside `infra/cdk` via npm workspaces, so they find `cdk.json` without any `cd`. Only `npx cdk ...` invoked by hand needs the directory.

The stack outputs `AlbDnsName` — the public URL of the app — and `TableName`.

### Seed the deployed table

CDK creates the table empty and nothing seeds it — a fresh deploy serves `{"items":[]}` until you populate it. Seed once after the first deploy. This must run against the real DynamoDB endpoint, so clear `DYNAMODB_ENDPOINT` (an unqualified `npm run db:seed` will otherwise hit a DynamoDB Local you left running):

```bash
DYNAMODB_ENDPOINT= AWS_PROFILE=<profile> AWS_REGION=<region> TABLE_NAME=MoviesApp npm run db:seed
```

`db:create-table` is not needed here — CDK already created the table with both GSIs.

`--profile` is a CDK/AWS-CLI flag and means nothing to the seed script — use the `AWS_PROFILE` environment variable instead.

### Smoke-test the deployment

```bash
ALB=$(aws cloudformation describe-stacks --stack-name MoviesStack \
  --query "Stacks[0].Outputs[?OutputKey=='AlbDnsName'].OutputValue" --output text)

curl "http://$ALB/health"
curl "http://$ALB/api/movies"
open "http://$ALB"

# or run the full Playwright suite against it
API_URL="http://$ALB" WEB_URL="http://$ALB" npm run test:e2e
```

### Building on Apple Silicon

The stack pins `Platform.LINUX_AMD64` so images run on x86 Fargate. On an M-series Mac that means a QEMU-emulated build every deploy — several minutes, and occasionally flaky on native npm dependencies.

Fargate supports ARM64, which builds natively on Apple Silicon and costs roughly 20% less. To switch, change both halves together in `infra/cdk/lib/movies-stack.ts` — the image platform and the task runtime platform must match, or tasks fail to start with an `exec format error`:

```typescript
// both DockerImageAsset definitions
platform: ecrAssets.Platform.LINUX_ARM64

// both FargateTaskDefinition definitions
runtimePlatform: {
  cpuArchitecture: ecs.CpuArchitecture.ARM64,
  operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
}
```

### Redeploying after a destroy

The table is created with a fixed name (`MoviesApp`) and `RemovalPolicy.RETAIN`, so `cdk destroy` leaves it behind. A later `cdk deploy` then tries to create a table that already exists and fails:

```
MoviesApp already exists in stack arn:aws:cloudformation:...
```

Before redeploying into the same account and region, either delete the retained table in the DynamoDB console, or import it into the new stack. This is the price of the retain policy, and it is worth paying.

## Production notes

- The DynamoDB table uses `RemovalPolicy.RETAIN` — a stack destroy will not delete your data. See [Redeploying after a destroy](#redeploying-after-a-destroy) for the trade-off that creates.
- Add an ACM certificate and an HTTPS listener on the ALB before putting this in front of real users; the HTTP listener here keeps the blueprint self-contained. Redirect `:80` to `:443` once you do.
- `CORS_ORIGIN` is not set on the ECS task, so the API defaults to `*`. That is harmless here because the ALB serves the SPA and the API on one origin and the frontend calls relative URLs — but set it explicitly the moment the frontend moves to its own domain.
- `/health` is reachable from the internet through the ALB listener rule. It returns only status and uptime, but if you would rather it were not public, drop `/health` from the rule's path patterns and give the target group its own health-check path that the listener does not expose.
- The API deletes movies with a transactional write covering the movie item and its genre adjacency items, so listings never see half-deleted state.
- The `npm audit` findings on the frontend (`vite`, `esbuild`) are dev-server-only advisories. The production image ships static files on Nginx and contains no Node runtime, so they do not apply to what is deployed.
- Rough running cost, `ap-southeast-2`, everything idle: ALB ~US$20/mo, one NAT gateway ~US$33/mo, four 0.25 vCPU / 0.5 GB Fargate tasks ~US$36/mo, plus DynamoDB on-demand and CloudWatch Logs. Call it **US$90/month** to leave it running. `npm run cdk:destroy` when you are done.
