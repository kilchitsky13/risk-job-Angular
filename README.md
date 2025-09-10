# risk-job-Angular
Angular UI triggers the risk job

# **Batch job architecture**

## **AWS Lambda + Step Functions / EventBridge** (serverless)

**When to pick:** jobs are short (e.g., < 15 minutes), stateless or can split into smaller steps, scaling needs vary, you want minimal infra ops.

**High-level flow**

1. User clicks UI → `POST /run-risk-job` (API Gateway + Lambda authorizer/Cognito).
2. API writes a job record to a DynamoDB table (jobId, status=PENDING, params) and returns `jobId`.
3. API triggers EventBridge Rule or starts a Step Functions state machine with `jobId`.
4. Step Function into a chain of Lambdas:

   * Lambda A: dequeue/read borrower IDs (or query source).
   * Lambda B: compute rating per borrower (can be parallelized with Map state).
   * Lambda C: write results to RDS (via RDS Proxy) or to DynamoDB / S3.
5. Update job status in DynamoDB. On failure, Step Functions records and can retry (configured per-step).

**Key AWS pieces**

* API Gateway (JWT authorizer using Cognito).
* Lambda functions (with IAM roles).
* Step Functions (for orchestration & retries).
* RDS + RDS Proxy (if writing to Oracle / MySQL/Postgres) or DynamoDB.
* Secrets Manager for DB credentials.
* CloudWatch + X-Ray + Alarms.

**Retries / error handling**

* Step Functions supports per-step `Retry` policy with exponential backoff and `Catch` to write to Dead Letter Queue (SQS) or mark job FAILED.
* Idle tasks (e.g., long DB writes) should use RDS Proxy to manage connections.
* Use idempotency keys when retrying writes to avoid duplicate results.

**Pros**

* Pay-per-use, easy scaling, good for event-driven workloads.
* Built-in observability with Step Functions console traces.

**Cons**

* Max execution time per Lambda (15 min) — split long jobs into chunks or use ECS for longer runs.

---

## **ECS Scheduled or On-Demand Tasks (Fargate)** (container-based)

**When to pick:** longer-running jobs, heavy CPU/IO work, need custom libraries or Oracle client not supported in Lambda, or tighter control of runtime.

**High-level flow**

1. `POST /run-risk-job` → API writes job record and enqueues job message in SQS (or starts ECS RunTask via API).
2. ECS Task (Fargate) consumes the SQS message, pulls borrower data (from Oracle RDS), computes ratings, writes results to RDS/S3.
3. Task updates job status (DynamoDB) and emits logs to CloudWatch.

**Key AWS pieces**

* ECS (Fargate) task definitions, task role with least privilege.
* SQS for durable queueing / DLQ.
* AWS Secrets Manager for DB creds, IAM role to access secrets.
* VPC + subnets + security groups (ECS tasks in private subnets to reach RDS).
* CloudWatch Logs & Metrics, Container Insights.
* Optional: AWS Batch if heavy batch compute scheduling is required.

**Retries / error handling**

* Use SQS visibility timeout + retry/dead-letter queue for transient task failures.
* Task should implement exponential backoff for transient external calls and optimistic/idempotent writes.
* Monitor CloudWatch metrics and create alarms for failed task counts.

**Pros**

* Supports long-running work, custom runtime, better control over resources.
* Easier local testing (containerized).

**Cons**

* More infra to operate than pure serverless; you pay for allocated resources while tasks run.

---

# Retry logic & error handling (server-side and client-side)

**Server-side**

* **Idempotency**: Make `/run-risk-job` idempotent or return and persist jobId so resubmissions are safe.
* **Dead-letter queue (DLQ)**: For failed job items after N retries, push to an SQS DLQ for manual inspection.
* **Idempotent writes**: Use upserts keyed by borrower id + job id to prevent duplicate inserts.
* **Observability**: instrument traces (AWS X-Ray), log structured events (jobId, step, elapsedMs, errors).
* **Alerting**: CloudWatch alarms for high error rate, increased DLQ counts, or long-running jobs.

**Client-side (Angular)**

* **UI feedback**: disable the button while job is being submitted; show spinner and status messages.
* **Immediate response**: Submit job and return jobId quickly; poll for status rather than blocking the user.
* **Client retries**: For transient network errors on submit, use small retry with exponential backoff (e.g., 3 attempts). But ensure submission is idempotent on server.
* **Status polling**: poll with increasing intervals (e.g., 2s → 4s → 8s) or use SSE/WebSockets if you want push updates.
* **User-friendly errors**: show clear messages and link to job details for troubleshooting or a “Retry” button if job failed.
* **Rate limiting / debounce**: prevent user from submitting the same job multiple times quickly.

---

# Security: API protected with AWS Cognito or IAM

### **AWS Cognito (recommended for web/mobile apps)**

* Use **Cognito User Pool** for user authentication (sign-in) and **Cognito App Client** in the Angular app.
* Angular obtains a JWT (ID token or access token) after the user logs in.
* API Gateway integrates Cognito Authorizer that validates the JWT automatically (no custom code).
* Backend verifies token (optional, e.g., check `scope`, `aud`, `exp`) if not using API Gateway authorizer.
* **Benefits**: simple JWT flow, scalable, supports OAuth2 flows (Authorization Code with PKCE for SPAs).
* **Client**: Use `amazon-cognito-identity-js` or AWS Amplify to handle login and token refresh; store token in memory (avoid localStorage if possible; use in-memory + refresh).
* **Server**: API Gateway + Lambda authorizer or built-in Cognito authorizer → pass identity to backend via `requestContext.authorizer`.

**Example header from Angular:**

```
Authorization: Bearer <access_token_jwt>
```

**Token validation**: check `iss`, `aud`, `exp`. Rotate signing keys using Cognito's JWKS endpoint.

---

### **IAM-based auth (SigV4)** — for machine clients or internal services

* Use when callers are AWS principals (EC2/ECS/Lambda) or when you want IAM policy control.
* API Gateway supports IAM authorization: clients sign each request with AWS Signature v4.
* Browser-based apps cannot securely hold AWS credentials; do this only when the app authenticates via a broker (Cognito Identity Pool) that issues temporary credentials.
* For SPAs: use Cognito Identity Pool to exchange authenticated Cognito user for temporary AWS credentials (limited lifetime), then sign requests — but this is more complex than JWT.

**When to use IAM**: internal services, service-to-service calls, or when strict IAM policies are required.

---

### Additional security controls

* **Least privilege** IAM roles for Lambdas/ECS tasks, only allow access to required resources.
* **Network security**: place RDS in private subnets, use security groups and VPC endpoints (S3, Secrets Manager).
* **Secrets**: store DB credentials in Secrets Manager (accessed by role).
* **Rate limiting / WAF**: apply API Gateway throttle and AWS WAF rules for public endpoints.
* **Audit logging**: enable CloudTrail and log authentication/authorization events.

---

# Monitoring & Alerts (short)

* **CloudWatch** metrics for job duration, success/failure rate, error counts.
* **Step Functions** executions and X-Ray traces for Lambda flows.
* **ECS**: Container Insights for CPU/memory and task restarts.
* **Alarms**: SNS notifications for high failure rate or DLQ messages.
* **Dashboards**: job throughput, average latency, percent failed.

