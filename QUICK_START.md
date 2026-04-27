# 🚀 Quick Start - Run Your SaaS Platform Now

## ⏱️ Total Time: 5 minutes

## Step 1: Start Backend (Terminal 1)

```bash
cd backend
npm run dev
```

**Expected Output**:

```
🚀 ShopOps AI Backend running on http://localhost:3001
   🆕 POST /api/auth/set-credentials    → Store AWS credentials
   🆕 POST /api/deploy                  → Deploy infrastructure to real AWS
   🆕 GET  /api/deployments             → List active deployments
   🆕 POST /api/destroy/:deploymentId   → Destroy infrastructure
   🆕 GET  /api/metrics/:deploymentId   → Get CloudWatch metrics
   🆕 POST /api/scale/:deploymentId     → Scale resources
```

## Step 2: Start Frontend (Terminal 2)

```bash
npm run dev
```

**Expected Output**:

```
  VITE v5.4.21  ready in 1093 ms
  ➜  Local:   http://localhost:5175/
```

## Step 3: Open Browser

- Go to `http://localhost:5175/` (or the port shown in Terminal 2)
- You should see the ShopOps welcome screen

## Step 4: Test the Flow (10 minutes)

### Option A: Quick Demo (Skip AWS)

1. Click "Start"
2. Select: Business Type → Traffic Level → Database Preference
3. Review cost and architecture
4. At "AWS Setup" step, click "Skip for Now"
5. At "Deploy" step, click "Next" to see deployment UI
6. At "Dashboard", see the deployment interface

### Option B: Full Real AWS Deployment (Need AWS Credentials)

1. Complete steps 1-5 as above
2. At "AWS Setup" step:
   - Get your AWS Access Key from IAM console
   - Enter Access Key ID and Secret Key
   - Select region (ap-south-1 recommended)
   - Click "Connect AWS Account"
   - Wait for "✓ Credentials verified!"
3. Click "Next"
4. Watch real-time deployment progress:
   - terraform init (30 sec)
   - terraform plan (30 sec)
   - terraform apply (2-3 min) ← Real AWS resources created here
5. See deployment outputs (VPC ID, Subnet IDs, RDS endpoint)
6. Click "Go to Dashboard"
7. In dashboard:
   - See your deployment card
   - Wait 1-2 min for CloudWatch metrics to appear
   - Try scaling: Enter instance type → Click "Apply Scaling Changes"
   - Try destroy: Click "Destroy" → Confirm → Watch resources tear down

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ Backend terminal shows "🚀 ShopOps AI Backend running on http://localhost:3001"
2. ✅ Frontend loads the beautiful 9-step wizard UI
3. ✅ Step 6 (AWS Setup) accepts credentials and verifies them
4. ✅ Step 7 (Deploy) shows real terraform output scrolling
5. ✅ Step 8 (Dashboard) displays your deployment
6. ✅ Metrics chart shows CPU utilization (1-2 min after deployment)
7. ✅ You can scale and destroy from the dashboard

## 🧪 Quick Test Checklist

| Step | Action                | Expected                                     |
| ---- | --------------------- | -------------------------------------------- |
| 6    | Enter invalid AWS key | "✕ Error: Invalid AWS credentials"           |
| 6    | Enter valid AWS key   | "✓ Credentials verified! Found X S3 buckets" |
| 7    | Deploy                | Real terraform output in log                 |
| 7    | Watch progress        | terraform init → plan → apply                |
| 8    | Dashboard loads       | Deployment card appears                      |
| 8    | Wait 2 min            | Metrics chart populates                      |
| 8    | Scale resources       | "Scaling completed successfully!"            |
| 8    | Destroy               | "Deployment destroyed successfully!"         |

## 🐛 Troubleshooting

### Error: Backend not responding

```
Fix: Check Terminal 1 shows "🚀 ShopOps AI Backend running"
If not: cd backend && npm install && npm run dev
```

### Error: "AWS credentials failed"

```
Fix: Use valid credentials from AWS IAM console
Make sure credentials have at least: S3, EC2, RDS, CloudWatch permissions
```

### Error: Deployment failed

```
Fix: Check AWS account has available resources
     (EC2 instances, RDS slots, VPC space)
View: Backend terminal shows full terraform error
```

### Metrics not showing

```
Fix: Wait 1-2 minutes after deployment
     CloudWatch takes time to collect metrics
     Metrics refresh every 60 seconds
```

## 📊 Behind the Scenes

When you deploy, here's what happens:

1. **Credentials Verified** (AWS SDK checks S3 access)
2. **Terraform Generated** (LLM creates infrastructure code)
3. **Deployment Directory Created** (backend/deployments/deploy\_\*)
4. **terraform init** (setup providers and modules)
5. **terraform plan** (preview changes)
6. **terraform apply** (creates VPC, EC2, RDS, etc. in AWS)
7. **Outputs Retrieved** (stores resource IDs)
8. **Dashboard Updated** (shows new deployment)
9. **Metrics Collected** (CloudWatch starts tracking)

Total time: 3-5 minutes

## 💡 Pro Tips

1. **Keep AWS Console Open**: See resources appear in real-time
2. **Check Deployment Directory**: `backend/deployments/deploy_*/` has all terraform files
3. **View State Files**: `backend/deployments/deploy_*/terraform.tfstate` shows current state
4. **Multiple Deployments**: Deploy multiple times, manage all from dashboard
5. **Scale Testing**: Try different instance types to see terraform diffs
6. **Destroy & Redeploy**: Quick way to test fresh infrastructure

## 🎉 That's It!

You now have a fully functional SaaS platform. Enjoy!

For detailed testing guide, see: **SAAS_USER_GUIDE.md**
For implementation details, see: **IMPLEMENTATION_SUMMARY.md**
