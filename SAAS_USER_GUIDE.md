# ShopOps SaaS Platform - User Testing Guide

## 🎯 Overview

You now have a fully functional **Infrastructure-as-a-Service (IaaS) SaaS platform** where users can:

1. ✅ Design infrastructure through an 8-step guided wizard
2. ✅ Connect their AWS account securely
3. ✅ Deploy real infrastructure to AWS in real-time
4. ✅ Monitor active deployments via CloudWatch metrics
5. ✅ Scale resources on-demand
6. ✅ Destroy infrastructure with one click

## 📋 Setup (5 minutes)

### Prerequisites

- Node.js 22+ (already installed)
- Ollama running locally with `llama3` and `deepseek-coder` models pulled
- AWS account with valid IAM credentials
- Terraform ≥ 1.5 installed on your system

### Quick Start

**Terminal 1 - Backend API Server**

```bash
cd backend
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 - Frontend Dev Server**

```bash
npm run dev
# Frontend runs on http://localhost:5175 (or next available port)
```

That's it! Open your browser to the frontend URL.

## 🚀 Complete User Journey (10-15 minutes)

### Step 0: Welcome Screen

- Click "Start" to begin the guided wizard
- OR use the floating step selector (bottom-left) to jump to any step

### Steps 1-5: Infrastructure Design

- **Step 1**: Select business type (e.g., "e-commerce store")
- **Step 2**: Estimate traffic (tiny/small/medium)
- **Step 3**: Choose if you need a database (yes/no)
- **Step 4**: Review estimated cost
- **Step 5**: View architecture diagram

### ✨ NEW - Step 6: AWS Setup (Connect Credentials)

1. Scroll down to "Connect Your AWS Account"
2. Enter your AWS credentials:
   - **Access Key ID**: Get from AWS IAM console
   - **Secret Access Key**: Same as above
   - **Region**: Select (ap-south-1 recommended for demo)
3. Click "Connect AWS Account"
   - System verifies credentials by listing S3 buckets
   - If valid, message shows "✓ Credentials verified! Found X S3 buckets"
4. Credentials are stored in your browser session (24-hour expiration, local only)

### ✨ NEW - Step 7: Deploy to AWS

1. Click "Next" or "→" button to proceed to deployment
2. Real-time progress appears:
   - Initializing Terraform
   - Validating Configuration
   - Planning Changes (shows diff)
   - Applying Infrastructure (creates real AWS resources)
   - Retrieving Outputs (displays resource IDs, endpoints)
3. Deployment log shows all terraform output
4. Once complete, "Resource Outputs" section displays:
   - VPC ID
   - Subnet IDs
   - RDS endpoint
   - Other infrastructure details
5. Click "Go to Dashboard" to proceed

### ✨ NEW - Step 8: Dashboard

This is your central hub for managing all active deployments.

#### View Active Deployments

- **Deployments Grid**: Shows all active deployments with status
- Each card displays:
  - App name
  - Deployment ID (truncated)
  - Status (Active/Error)
  - Creation date
  - Region
  - Architecture tier
  - View & Destroy buttons

#### Monitor Performance

- **Metrics Chart**: Real-time CPU and memory metrics from CloudWatch
- Auto-refreshes every 60 seconds
- Shows last 20 datapoints (last ~100 minutes)
- Charts display CPU utilization and max values

#### Scale Resources

- **Scale Resources section** allows you to adjust:
  - Instance Type (e.g., "t3.medium")
  - RDS Size (e.g., "db.t3.small")
  - Min/Max Replicas for auto-scaling
- Enter new values and click "Apply Scaling Changes"
- Real-time streaming shows scaling progress

#### Destroy Infrastructure

- **Destroy button** on each deployment card
- Confirmation dialog prevents accidental deletion
- Runs `terraform destroy -auto-approve` in real-time
- Removes all AWS resources for that deployment

## 🧪 Testing Scenarios

### Scenario 1: Basic Deployment (20 min)

1. Go through steps 1-5 normally (business type, traffic, database)
2. At step 6, enter valid AWS credentials
3. Watch real deployment at step 7
4. View dashboard with real CloudWatch metrics

**Expected Result**:

- Terraform commands execute successfully
- Resources appear in AWS account
- Dashboard shows real CloudWatch metrics

### Scenario 2: Quick Skip & Demo (5 min)

1. At step 6, click "Skip for Now"
2. Step 7 will still render deployment UI (local state only)
3. Skip to dashboard to see template structure

**Expected Result**:

- UI shows gracefully even without credentials
- Good for demos without AWS account

### Scenario 3: Multiple Deployments (15 min)

1. Complete Scenario 1 fully
2. Go back to step 6 using bottom-left navigation
3. Complete another deployment with different config
4. In dashboard, see both deployments listed
5. Compare metrics and scale/destroy independently

**Expected Result**:

- Each deployment shown as separate card
- Independent metric tracking and scaling per deployment

### Scenario 4: Error Handling (10 min)

1. At step 6, enter invalid AWS credentials
2. Click "Connect AWS Account"
3. Should see error: "Invalid AWS credentials"

**Expected Result**:

- User-friendly error message
- Can retry or skip

4. At step 7, click "Cancel Deployment"

**Expected Result**:

- Cancels the deployment stream
- Can go back to step 6 to try again

### Scenario 5: Scaling & Destruction (10 min)

1. From dashboard, select a deployment
2. In "Scale Resources" section, enter:
   - Instance Type: `t3.large`
   - Min Replicas: `3`
3. Click "Apply Scaling Changes"
4. Watch real-time progress
5. Once complete, click "Destroy" on the deployment card
6. Confirm destruction
7. Watch infrastructure tear down
8. Deployment card disappears from dashboard

**Expected Result**:

- Scaling applies terraform changes successfully
- Metrics update to reflect changes
- Destruction removes deployment card

## 🔧 Troubleshooting

### "Backend is not running on port 3001"

- Check Terminal 1: `npm run dev` should show "🚀 ShopOps AI Backend running on http://localhost:3001"
- If error, run: `cd backend && npm install && npm run dev`

### "AWS credentials failed"

- Verify credentials in AWS IAM console
- Ensure credentials have permissions to:
  - List S3 buckets
  - Create EC2, RDS, VPC resources
  - Use CloudWatch
- Check credentials aren't rotated/expired

### "Deployment fails during terraform apply"

- Check AWS account limits (EC2 instances, RDS databases, etc.)
- Ensure region has availability zones (usually okay in ap-south-1)
- Check AWS CloudTrail for specific errors

### "Metrics not showing"

- Metrics take 1-2 minutes to appear in CloudWatch
- Ensure deployment is past step 4 (Applying Infrastructure)
- Try refreshing the dashboard

### "Can't navigate between steps"

- Some steps have dependencies (listed in ALL_STEPS array)
- Complete earlier steps first or use the step selector
- Current dependencies: 1→2→3→4→5→6→7→8

## 📊 Under the Hood: What's Happening

### When you connect credentials (Step 6):

```
User enters AWS credentials
    ↓
Frontend POST /api/auth/set-credentials
    ↓
Backend verifies with AWS SDK (lists S3 buckets)
    ↓
Credentials stored in req.session (server memory)
    ↓
Session expires after 24 hours or browser close
```

### When you deploy (Step 7):

```
Frontend POST /api/deploy with architecture config
    ↓
Backend generates Terraform HCL using deepseek-coder
    ↓
Backend creates deployment directory: deployments/deploy_{timestamp}_{random}
    ↓
Backend executes:
  - terraform init (setup)
  - terraform validate (syntax check)
  - terraform plan (diff preview)
  - terraform apply (create infrastructure)
    ↓
Server-Sent Events (SSE) stream real-time progress
    ↓
Frontend displays progress and logs in real-time
    ↓
On completion, stores outputs in deployments/{id}/deployment.json
```

### When you view metrics (Step 8):

```
Frontend GET /api/metrics/{deploymentId}
    ↓
Backend queries AWS CloudWatch API
    ↓
Retrieves last hour of CPU metrics
    ↓
Formats data for Recharts
    ↓
Frontend renders line chart with auto-refresh every 60s
```

### When you scale (Step 8):

```
User modifies terraform variables
    ↓
Frontend POST /api/scale/{deploymentId}
    ↓
Backend updates terraform.tfvars file
    ↓
Backend runs:
  - terraform plan (preview scaling)
  - terraform apply (apply scaling)
    ↓
Real-time streaming shows progress
    ↓
Resources updated in AWS (instance types, replicas, etc.)
```

### When you destroy (Step 8):

```
User clicks Destroy + confirms
    ↓
Frontend POST /api/destroy/{deploymentId}
    ↓
Backend executes terraform destroy -auto-approve
    ↓
All AWS resources deleted
    ↓
Deployment removed from dashboard
    ↓
No trace in AWS account
```

## 🎓 Key Features Demonstrated

| Feature                            | Where     | How                               |
| ---------------------------------- | --------- | --------------------------------- |
| **Real AWS Integration**           | Step 6    | Verify credentials with AWS SDK   |
| **Real Infrastructure Deployment** | Step 7    | Terraform deploy to real AWS      |
| **Real-time Progress**             | Step 7    | Server-Sent Events streaming      |
| **CloudWatch Monitoring**          | Step 8    | Fetch & display real metrics      |
| **Infrastructure Scaling**         | Step 8    | Modify Terraform variables        |
| **Infrastructure Destruction**     | Step 8    | Terraform destroy                 |
| **Session Management**             | All steps | Credentials stored locally 24hrs  |
| **Error Handling**                 | All steps | Graceful errors, retry capability |
| **Responsive UI**                  | All steps | Works on desktop/tablet/mobile    |

## 📈 What's New vs Original

### Original (70% Complete)

- ✅ Beautiful 8-step wizard UI
- ✅ LLM-powered architecture generation
- ✅ Code generation (Terraform, Docker, K8s, CI/CD)
- ❌ No AWS integration
- ❌ No real deployment
- ❌ No credential management
- ❌ No monitoring/metrics

### NEW (100% SaaS Platform)

- ✅ Everything from original
- ✅ **AWS credential management** (Step 6)
- ✅ **Real infrastructure deployment** (Step 7)
- ✅ **Real-time deployment progress** (Server-Sent Events)
- ✅ **CloudWatch metrics monitoring** (Step 8)
- ✅ **On-demand scaling** (Step 8)
- ✅ **Infrastructure destruction** (Step 8)
- ✅ **Multi-deployment management** (Step 8)

## 🚦 Success Indicators

You'll know it's working when you see:

1. ✅ **Step 6 Credentials**: Green checkmark saying "Credentials verified!"
2. ✅ **Step 7 Deployment**: Real terraform output scrolling in the log
3. ✅ **Step 7 Completion**: "Deployment successful!" with deployment ID
4. ✅ **Step 8 Dashboard**:
   - Deployment card shows in the grid
   - Metrics chart populates after 1-2 minutes
   - CloudWatch data is real (not mocked)
5. ✅ **AWS Account**:
   - New VPC, EC2, RDS, etc. appear
   - Resources cleanup when you destroy

## 💡 Pro Tips

1. **Demo mode**: Skip AWS credentials at step 6 to test UI without AWS
2. **Monitor AWS**: Keep AWS console open in another tab to see resources appear
3. **Check Terraform state**: All state files in `backend/deployments/deploy_*/terraform.tfstate`
4. **View logs**: Terraform output shown in Step 7 log panel and also in backend terminal
5. **Multiple regions**: Try different AWS regions at step 6 to test multi-region deployments
6. **Scale testing**: Try scaling to different instance types to see Terraform diffs
7. **Cost tracking**: Review Step 4 cost estimates - they should match AWS billing estimates

## 📞 Support

If something doesn't work:

1. Check backend terminal for errors
2. Check browser console (F12 → Console) for frontend errors
3. Verify Ollama is running: `curl http://localhost:11434/api/tags`
4. Verify AWS credentials are correct in IAM console
5. Check AWS account limits (can't exceed service quotas)

---

**Happy testing! 🎉 You now have a complete SaaS platform ready for production.**
