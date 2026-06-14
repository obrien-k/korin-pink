# GCP

Uses Cloud Run (API, irc-bridge), Compute Engine (Ergo), Cloud Storage (web).
Integrates natively with Google Workspace (Drive, Gmail, Gemini).

## prerequisites

- GCP project with billing enabled
- `gcloud` CLI authenticated
- `terraform` >= 1.7
- Docker

## 1. enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  drive.googleapis.com \
  gmail.googleapis.com \
  storage.googleapis.com
```

## 2. Terraform

```bash
cd infra/gcp

# create state bucket first
gsutil mb gs://korin-pink-tfstate

# init + apply
terraform init
terraform apply -var="project_id=YOUR_PROJECT" -var="region=us-central1"
```

Outputs: `api_url`, `ergo_ip`, `web_bucket`.

## 3. GCP Secret Manager

```bash
for secret in \
  stellar-api-url stellar-api-key stellar-pull-key \
  gemini-api-key irc-bridge-secret irc-bot-pass irc-oper-pass \
  drive-root-folder drive-wiki-folder; do
  echo -n "value" | gcloud secrets create $secret --data-file=-
done
```

## 4. GitHub Actions (OIDC — no long-lived keys)

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"

# Bind to service account
gcloud iam service-accounts add-iam-policy-binding \
  korin-api@YOUR_PROJECT.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUM/locations/global/workloadIdentityPools/github/attribute.repository/YOUR_ORG/korin.pink"
```

Set GH secrets: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`.

## 5. Ergo on Compute Engine

```bash
# SSH into the Ergo instance
gcloud compute ssh korin-ergo --zone=us-central1-a

# First-run: generate oper password hash
docker exec ergo ergo genpasswd
# update ergo.yaml, rebuild image, push to Artifact Registry
```

## 6. DNS

```
A     korin.pink      → Cloud Storage Load Balancer IP (from terraform output)
A     irc.korin.pink  → ergo_ip (from terraform output)
```

## notes

- Ergo runs on `e2-micro` (~$7/mo). Upgrade to `e2-small` if you see OOM.
- Cloud Run API scales to zero when idle — cold starts ~1s on Fastify.
- For the irc-bridge on Cloud Run: it's set to `min_instance_count = 1` intentionally (needs persistent IRC connection).
- Workspace domain-wide delegation required for Gmail API — set up in Google Admin.
