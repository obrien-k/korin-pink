# AWS

Ergo runs on EC2 (needs persistent TCP).  
API and irc-bridge run on ECS Fargate or EC2, your call.  
Static web on S3 + CloudFront.

## architecture

```
Route 53
  ├── korin.pink       → CloudFront → S3 (web)
  └── irc.korin.pink   → EC2 (Ergo)

ECS Fargate
  ├── korin-api        (Cloud Run equivalent)
  └── korin-irc-bridge (min 1 task — persistent IRC connection)

ECR — Docker images
Secrets Manager — all secrets
```

## prerequisites

- AWS account + CLI (`aws configure`)
- Docker
- (optional) Terraform or CDK for IaC

## 1. ECR — push images

```bash
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REGISTRY=$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com

aws ecr create-repository --repository-name korin/api
aws ecr create-repository --repository-name korin/irc-bridge
aws ecr create-repository --repository-name korin/ergo

aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $REGISTRY

docker build -t $REGISTRY/korin/api:latest       ./packages/api
docker build -t $REGISTRY/korin/irc-bridge:latest ./packages/irc-bridge
docker build -t $REGISTRY/korin/ergo:latest       ./packages/irc

docker push $REGISTRY/korin/api:latest
docker push $REGISTRY/korin/irc-bridge:latest
docker push $REGISTRY/korin/ergo:latest
```

## 2. Secrets Manager

```bash
for secret in \
  stellar-api-url stellar-api-key stellar-pull-key \
  gemini-api-key irc-bridge-secret irc-bot-pass irc-oper-pass \
  drive-root-folder drive-wiki-folder; do
  aws secretsmanager create-secret --name "korin/$secret" --secret-string "REPLACE_ME"
done
```

## 3. Ergo on EC2

```bash
# Launch a t3.micro (or t4g.micro for arm64 — cheaper)
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \   # Amazon Linux 2023 us-east-1
  --instance-type t3.micro \
  --key-name your-keypair \
  --security-group-ids sg-ERGO \       # open 6667, 6697, 8097
  --user-data file://infra/aws/ergo-userdata.sh

# Security group for Ergo
aws ec2 create-security-group --group-name ergo-irc --description "Ergo IRC"
aws ec2 authorize-security-group-ingress --group-name ergo-irc \
  --protocol tcp --port 6667 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name ergo-irc \
  --protocol tcp --port 6697 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name ergo-irc \
  --protocol tcp --port 8097 --cidr 0.0.0.0/0
```

`infra/aws/ergo-userdata.sh`:
```bash
#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin $REGISTRY
docker run -d --restart=always \
  -p 6667:6667 -p 6697:6697 -p 8097:8097 \
  -v /data/ergo:/var/lib/ergo \
  $REGISTRY/korin/ergo:latest
```

## 4. ECS Fargate — API + bridge

```bash
# Create cluster
aws ecs create-cluster --cluster-name korin

# Task definitions: see infra/aws/task-definitions/
# (api.json, irc-bridge.json — standard ECS task def format)

# Services
aws ecs create-service \
  --cluster korin \
  --service-name korin-api \
  --task-definition korin-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-XXX],securityGroups=[sg-XXX],assignPublicIp=ENABLED}"

# irc-bridge: desired-count=1, never scale down (persistent IRC conn)
aws ecs create-service \
  --cluster korin \
  --service-name korin-irc-bridge \
  --task-definition korin-irc-bridge \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-XXX],securityGroups=[sg-XXX],assignPublicIp=ENABLED}"
```

## 5. S3 + CloudFront — static web

```bash
BUCKET=korin-pink-web
aws s3 mb s3://$BUCKET
aws s3 website s3://$BUCKET --index-document index.html
aws s3 sync ./packages/web s3://$BUCKET --delete

# CloudFront distribution: point to S3 bucket
# (use console or CDK — too verbose for inline CLI)
```

## 6. Route 53

```bash
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name korin.pink --query "HostedZones[0].Id" --output text)

# korin.pink → CloudFront (add CNAME or alias)
# irc.korin.pink → EC2 Elastic IP
```

## GitHub Actions

Replace the GCP OIDC setup with AWS OIDC:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT }}:role/github-actions-korin
    aws-region: us-east-1
```

Set GH secrets: `AWS_ACCOUNT`, and configure the OIDC trust policy on the IAM role.

## notes

- TLS for Ergo on EC2: use ACM + NLB (TCP passthrough) or certbot directly on the instance.
- ECS Fargate cold starts are slower than Cloud Run (~5-10s). Use `FARGATE_SPOT` for the API to cut cost; keep irc-bridge on standard Fargate.
- `t4g.micro` (arm64) is ~40% cheaper than `t3.micro` — the Ergo Dockerfile builds for the host arch; add a `--platform linux/arm64` flag if needed.
