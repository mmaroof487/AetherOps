# 🚀 GitHub Actions Setup Guide

Complete step-by-step guide to enable CI/CD in your GitHub repository.

---

## 1️⃣ Initial Setup

### Enable GitHub Actions

1. Go to your repository
2. Click **Settings** → **Actions** → **General**
3. Ensure "Allow all actions and reusable workflows" is selected
4. Click **Save**

### Set Up Secrets

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:

---

## 2️⃣ Required Secrets

### AWS Credentials (for ECR & ECS deployment)

```
AWS_ACCOUNT_ID
- Get from: AWS Console → Account ID (top right)

AWS_ACCESS_KEY_ID
- Get from: AWS → IAM → Users → Create access key

AWS_SECRET_ACCESS_KEY
- Get from: AWS → IAM → Users → Create access key
```

**Steps to create AWS access key:**

1. Go to AWS IAM Console
2. Select your user
3. Click "Create access key"
4. Choose "Other"
5. Copy the Access Key ID and Secret Access Key
6. Store safely (AWS won't show again!)

### Docker Registry (optional, for DockerHub)

```
DOCKERHUB_USERNAME
- Your DockerHub username

DOCKERHUB_TOKEN
- Get from: DockerHub → Account Settings → Security → New Access Token
```

**Steps to create DockerHub token:**

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token
5. Use it as DOCKERHUB_TOKEN

### Slack Notifications (optional)

```
SLACK_WEBHOOK_URL
- Get from: Slack → Your App → Incoming Webhooks → Copy Webhook URL
```

**Steps to create Slack webhook:**

1. Go to https://api.slack.com/apps
2. Create New App (or use existing)
3. Click "Incoming Webhooks"
4. Turn on "Activate Incoming Webhooks"
5. Click "Add New Webhook to Workspace"
6. Select channel (e.g., #deployments)
7. Copy the Webhook URL

---

## 3️⃣ AWS IAM Setup

### Create IAM Role for GitHub Actions

Create this policy and attach to a role:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"ecr:GetAuthorizationToken",
				"ecr:BatchGetImage",
				"ecr:GetDownloadUrlForLayer",
				"ecr:DescribeImages",
				"ecr:CreateRepository",
				"ecr:PutImage",
				"ecr:InitiateLayerUpload",
				"ecr:UploadLayerPart",
				"ecr:CompleteLayerUpload"
			],
			"Resource": "arn:aws:ecr:*:YOUR_ACCOUNT_ID:repository/*"
		},
		{
			"Effect": "Allow",
			"Action": ["ecs:UpdateService", "ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:DescribeTasks", "ecs:ListTasks"],
			"Resource": "*"
		},
		{
			"Effect": "Allow",
			"Action": ["eks:UpdateClusterConfig", "eks:DescribeCluster"],
			"Resource": "arn:aws:eks:*:YOUR_ACCOUNT_ID:cluster/*"
		}
	]
}
```

### Set Up OIDC (Recommended)

For better security, use GitHub OIDC instead of static credentials:

1. Go to AWS IAM Console
2. Create Identity Provider:
   - Provider type: OpenID Connect
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

3. Create Role with Trust Relationship:
   ```json
   {
   	"Version": "2012-10-17",
   	"Statement": [
   		{
   			"Effect": "Allow",
   			"Principal": {
   				"Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
   			},
   			"Action": "sts:AssumeRoleWithWebIdentity",
   			"Condition": {
   				"StringEquals": {
   					"token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
   					"token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/shopops-infra:ref:refs/heads/main"
   				}
   			}
   		}
   	]
   }
   ```

---

## 4️⃣ Create ECR Repositories

```bash
# Backend repository
aws ecr create-repository \
  --repository-name shopops-app-backend \
  --region ap-south-1

# Frontend repository
aws ecr create-repository \
  --repository-name shopops-app-frontend \
  --region ap-south-1

# Set lifecycle policies (optional - auto-delete old images)
aws ecr put-lifecycle-policy \
  --repository-name shopops-app-backend \
  --lifecycle-policy-text file://ecr-lifecycle-policy.json
```

**ecr-lifecycle-policy.json:**

```json
{
	"rules": [
		{
			"rulePriority": 1,
			"description": "Keep last 10 images",
			"selection": {
				"tagStatus": "any",
				"countType": "imageCountMoreThan",
				"countNumber": 10
			},
			"action": {
				"type": "expire"
			}
		}
	]
}
```

---

## 5️⃣ Environment-Specific Setup

### Add Branch Protection

1. Go to **Settings** → **Branches**
2. Add rule for `main`:
   - Require status checks to pass before merging
   - Require code reviews before merging (optional)
   - Dismiss stale reviews (optional)

### Create Environments

1. Go to **Settings** → **Environments**
2. Create `staging` environment:
   - Deployment branches: `develop`
   - Reviewers: Select team members
3. Create `production` environment:
   - Deployment branches: `main`, release tags
   - Reviewers: Select team members

---

## 6️⃣ Workflow Execution

### Manual Trigger

```bash
# Trigger deployment workflow manually
gh workflow run deploy.yml \
  -f environment=staging \
  -f image-tag=latest
```

### Automatic Triggers

Workflows run automatically on:

- **Push to main** - Full CI/CD
- **Pull Requests** - Lint, build, security
- **Tags (v*.*.\*)** - Build and deploy
- **Schedule** - Security scans (weekly)

---

## 7️⃣ Monitoring & Debugging

### View Workflow Runs

1. Go to **Actions** tab
2. Select workflow
3. View build logs, artifacts, test results

### Debug Failed Workflow

```bash
# Re-run failed job
# Click "Re-run job" in GitHub UI

# Or view detailed logs
gh run view <run-id> --log
```

### Upload Artifacts

Workflows automatically upload:

- Frontend build (`dist/`)
- Test coverage reports
- Dependency check reports
- SARIF security reports

---

## 8️⃣ Common Issues & Solutions

### Issue: "Secret not found"

**Solution:** Check secret name matches workflow (case-sensitive)

### Issue: "docker push failed"

**Solution:** Ensure DockerHub credentials are correct and token hasn't expired

### Issue: "ECS deployment failed"

**Solution:** Check IAM permissions, ensure ECS cluster/service exists

### Issue: "Workflow stuck waiting"

**Solution:** May be waiting for approval. Check environment reviewers.

---

## 9️⃣ Testing Locally (Optional)

Use `act` to test workflows locally:

```bash
# Install act (Mac)
brew install act

# Install act (Windows)
choco install act-cli

# Run workflow locally
act -l                           # List workflows
act push -j ci                   # Run CI job
act -s AWS_ACCOUNT_ID=123456789 # Set secrets
```

---

## 🔟 Final Checklist

- [ ] GitHub Actions enabled
- [ ] All required secrets added
- [ ] AWS IAM role created
- [ ] ECR repositories created
- [ ] Branch protection rules set
- [ ] Environments configured
- [ ] First push to main triggers CI
- [ ] Docker build & push succeeds
- [ ] Security scans complete
- [ ] Deployment successful

---

## 📞 Helpful Commands

```bash
# List secrets (names only, not values)
gh secret list

# Update secret
gh secret set SECRET_NAME --body "new_value"

# Remove secret
gh secret delete SECRET_NAME

# View GitHub Actions usage
gh run list

# Cancel workflow run
gh run cancel <run-id>

# View workflow artifacts
gh run download <run-id>
```

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS IAM Documentation](https://docs.aws.amazon.com/iam/)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)

---

**Last Updated:** April 2026
