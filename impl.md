# ShopOps Infra - Feature Implementation Plan (AI IDE Prompt)

Use this document to guide AI code assistants (Claude, GitHub Copilot, etc.) through implementing missing features.

---

## FEATURE 1: Terraform Remote State (S3 + DynamoDB)

### Context
Currently, Terraform state is stored locally in the project directory. For production and team collaboration, state should be stored remotely in AWS S3 with locking via DynamoDB.

### Implementation Steps

**Step 1: Update Terraform Generation Logic** (backend/server.js)
```
Location: POST /api/terraform endpoint
Task: Modify Terraform generation to include backend.tf file

Generated backend.tf should contain:
terraform {
  backend "s3" {
    bucket         = "shopops-terraform-state-{random}"
    key            = "terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "shopops-terraform-lock"
  }
}

Requirements:
- Generate unique bucket name (include tenant ID or timestamp)
- Enable encryption by default
- Specify DynamoDB table for state locking
- Add comments explaining each setting
```

**Step 2: Create S3 Bucket & DynamoDB Table in Generated Code**
```
Location: Same Terraform generation
Task: Add S3 and DynamoDB resource definitions to generated code

In generated main.tf or new state-backend.tf:
- aws_s3_bucket: "shopops-terraform-state"
  - enable versioning
  - enable encryption (SSE-S3)
  - block all public access
  
- aws_dynamodb_table: "shopops-terraform-lock"
  - attribute: LockID (String)
  - billing_mode: PAY_PER_REQUEST
  - point_in_time_recovery enabled

Requirements:
- Resources created automatically before main deployment
- Safe cleanup (don't delete bucket on terraform destroy)
- Encryption enabled by default
```

**Step 3: Update Backend Integration**
```
Location: Backend API (/api/terraform endpoint)
Task: When deploying, initialize Terraform with remote backend

Code changes:
1. After generating Terraform files, run: terraform init
2. This will prompt for backend setup
3. Suppress prompts with: terraform init -backend-config=...
4. Store state in S3 automatically

Requirements:
- No manual bucket creation needed
- Seamless for users
- Works with existing deployment flow
```

**Step 4: Add State Locking Verification**
```
Location: Backend deployment logic
Task: Verify DynamoDB locking works for concurrent applies

Testing:
- Run terraform apply in two terminals simultaneously
- Second apply should wait for first to complete
- Verify DynamoDB has lock entry
- Verify lock releases after apply completes

Requirements:
- Clear error if lock times out
- Reasonable timeout (5-10 minutes)
- User-friendly message if lock held too long
```

**Step 5: Update Dashboard/Frontend**
```
Location: Frontend (Credentials/Deployment screens)
Task: Show state location to user

Display:
- "State stored in: s3://shopops-terraform-state-XXXX"
- "State locked with: DynamoDB table"
- Button to "View State in S3 Console"
- Warning: "Don't delete S3 bucket or DynamoDB table"

Requirements:
- Clear information for users
- Link to AWS Console
```

### Testing Checklist
- [ ] Generate Terraform → Verify backend.tf included
- [ ] S3 bucket auto-created
- [ ] DynamoDB table auto-created
- [ ] terraform init succeeds with remote backend
- [ ] State file appears in S3
- [ ] Run terraform apply twice simultaneously → Lock works
- [ ] Dashboard shows state location

### Success Criteria
✓ Terraform state stored in S3 (not local)
✓ DynamoDB locking prevents concurrent updates
✓ Users understand state location
✓ No manual setup required

---

## FEATURE 2: Kubernetes ConfigMaps & Secrets

### Context
Currently, K8s manifests may have hardcoded configuration or missing secrets management. ConfigMaps store non-sensitive config, Secrets store sensitive data.

### Implementation Steps

**Step 1: Generate ConfigMap in K8s Creation**
```
Location: POST /api/k8s endpoint in backend/server.js
Task: Generate ConfigMap manifest

Generated configmap.yaml:
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: shopops
data:
  APP_ENV: "production"
  APP_PORT: "3000"
  DB_HOST: "rds-instance.c9akciq32.us-east-1.rds.amazonaws.com"
  DB_PORT: "5432"
  LOG_LEVEL: "info"
  CACHE_TTL: "3600"

Requirements:
- Generate based on wizard inputs (scale, tier, region)
- Include reasonable defaults
- Add comments explaining each config
- Non-sensitive data only (no passwords)
```

**Step 2: Generate Secret in K8s Creation**
```
Location: Same POST /api/k8s endpoint
Task: Generate Secret manifest

Generated secret.yaml:
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: shopops
type: Opaque
data:
  DB_PASSWORD: (base64-encoded)
  DB_USER: (base64-encoded)
  API_KEY: (base64-encoded)
  JWT_SECRET: (base64-encoded)

Requirements:
- Base64 encode all values (Kubernetes standard)
- Generate random secrets where applicable
- Add note: "Replace with actual values before deploying"
- Sensitive data only (passwords, API keys, tokens)

Generated comment in manifest:
# IMPORTANT: Replace the base64-encoded values with actual secrets
# Do NOT commit secrets to version control
# Use: kubectl create secret generic app-secrets --from-literal=...
```

**Step 3: Update Deployment to Reference ConfigMap & Secret**
```
Location: Same POST /api/k8s endpoint
Task: Modify Deployment manifest to inject env vars from ConfigMap/Secret

In Deployment spec.template.spec.containers:

env:
  # From ConfigMap
  - name: APP_ENV
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: APP_ENV
  - name: DB_HOST
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: DB_HOST
  
  # From Secret
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: DB_PASSWORD
  - name: DB_USER
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: DB_USER

Requirements:
- All environment variables injected from ConfigMap/Secret
- No hardcoded values in Deployment
- Clear labels indicating source (ConfigMap vs Secret)
```

**Step 4: Add Secret Creation Instructions**
```
Location: Generated README.md or deployment guide
Task: Document how to create actual secrets

Instructions:
kubectl create secret generic app-secrets \
  --from-literal=DB_PASSWORD=your_password \
  --from-literal=DB_USER=admin \
  --from-literal=API_KEY=your_api_key \
  --from-literal=JWT_SECRET=your_jwt_secret \
  -n shopops

Or:
kubectl apply -f secret.yaml
# Then edit the base64 values

Requirements:
- Clear step-by-step instructions
- Examples with placeholder values
- Warning about committing secrets to git
- Link to K8s Secrets best practices
```

**Step 5: Add Secret Rotation Documentation**
```
Location: Operations guide
Task: Document how to update secrets

Instructions:
# Update single secret value
kubectl patch secret app-secrets -p '{"data":{"DB_PASSWORD":"'$(echo -n 'newpass' | base64)'"}}'

# Or delete and recreate
kubectl delete secret app-secrets
kubectl create secret generic app-secrets --from-literal=...

# Restart pods to pick up new values
kubectl rollout restart deployment/shopops-app

Requirements:
- Clear update procedures
- Verification steps
- Handling pod restarts
```

### Testing Checklist
- [ ] Generate K8s → Verify ConfigMap in output
- [ ] Generate K8s → Verify Secret in output
- [ ] ConfigMap contains expected config keys
- [ ] Secret contains expected secret keys
- [ ] Deployment references ConfigMap and Secret
- [ ] kubectl apply → ConfigMap created
- [ ] kubectl apply → Secret created
- [ ] kubectl get configmap → Shows config
- [ ] kubectl get secret → Shows encrypted data
- [ ] Pod env vars populated from ConfigMap
- [ ] Pod env vars populated from Secret
- [ ] Update secret → Pod environment updated
- [ ] README includes secret management instructions

### Success Criteria
✓ No hardcoded config in manifests
✓ ConfigMap stores non-sensitive config
✓ Secret stores sensitive data (encrypted)
✓ Deployment injects env vars from both
✓ Users have clear instructions for secret management

---

## FEATURE 3: Prometheus + Grafana Monitoring

### Context
Real-time monitoring shows infrastructure health. Prometheus collects metrics, Grafana visualizes them.

### Implementation Steps

**Step 1: Generate Prometheus Deployment Manifest**
```
Location: POST /api/k8s endpoint
Task: Generate prometheus-deployment.yaml

Generated manifest should include:
- Deployment: prometheus
- ServiceAccount, ClusterRole, ClusterRoleBinding (RBAC)
- ConfigMap: prometheus config
- Service: Expose Prometheus on port 9090
- PersistentVolumeClaim: Store metrics (optional)

Prometheus ConfigMap should scrape:
- kubelet (node metrics)
- kube-state-metrics (K8s resource metrics)
- app pods (custom app metrics on /metrics)

Requirements:
- Proper RBAC permissions
- Resource limits: CPU 500m, Memory 512Mi
- Retention: 30 days of metrics
- Storage: 10Gi PVC
```

**Step 2: Generate Grafana Deployment Manifest**
```
Location: POST /api/k8s endpoint
Task: Generate grafana-deployment.yaml

Generated manifest should include:
- Deployment: grafana
- Service: Expose Grafana on port 3000
- ConfigMap: Grafana config + datasources
- Secrets: Admin password

DataSources ConfigMap:
- Prometheus datasource pointing to http://prometheus:9090
- Pre-configured dashboard for Kubernetes metrics

Requirements:
- Grafana admin password auto-generated (in Secret)
- Default datasource: Prometheus
- Default dashboards: Kubernetes cluster monitoring
- Persistent storage for dashboards
```

**Step 3: Generate Grafana Dashboard Templates**
```
Location: K8s generation
Task: Pre-configure Grafana dashboards

Dashboard 1: Kubernetes Cluster Overview
- CPU usage across cluster
- Memory usage across cluster
- Pod count and status
- Network I/O

Dashboard 2: Application Performance
- Request rate (requests/sec)
- Request latency (p50, p95, p99)
- Error rate
- Response status distribution

Dashboard 3: Resource Utilization
- CPU usage per pod
- Memory usage per pod
- Disk I/O
- Network connections

Requirements:
- Dashboards use Prometheus as source
- Auto-refresh every 30 seconds
- Suitable for production monitoring
```

**Step 4: Configure Prometheus Alert Rules**
```
Location: Prometheus ConfigMap generation
Task: Define alert rules

Alert rules to include:
- HighCPUUsage: CPU > 80% for 5 minutes
- HighMemoryUsage: Memory > 80% for 5 minutes
- PodCrashLooping: Pod restart > 3 times
- ServiceDown: Service response time > 5 seconds
- DiskUsageHigh: Disk > 85%

Requirements:
- Clear alert descriptions
- Appropriate thresholds for "Growth" tier
- Severity levels: critical, warning
- Can be customized by user
```

**Step 5: Add Metrics Collection to Generated App**
```
Location: Generated Dockerfile/app config
Task: Ensure app exposes /metrics endpoint

Requirements:
- Document: Application must expose /metrics in Prometheus format
- Example: Node.js app using prom-client library
- Example: Python app using prometheus-client
- Example: Go app using prometheus client
- Metrics to expose:
  - http_requests_total (counter)
  - http_request_duration_seconds (histogram)
  - app_errors_total (counter)
```

**Step 6: Update Frontend Dashboard**
```
Location: Frontend EnhancedDashboardScreen.jsx
Task: Add link to Grafana dashboards

Changes:
- Add button: "View Grafana Dashboards"
- Provide Grafana URL: kubectl port-forward svc/grafana 3000:3000
- Instructions: Default login admin/password
- Link to specific dashboards by name

Requirements:
- Clear instructions for accessing Grafana
- Default login credentials displayed
- Links to pre-configured dashboards
```

### Testing Checklist
- [ ] Generate K8s → Verify Prometheus manifest included
- [ ] Generate K8s → Verify Grafana manifest included
- [ ] kubectl apply → Prometheus pod Running
- [ ] kubectl apply → Grafana pod Running
- [ ] kubectl port-forward prometheus 9090:9090 → Accessible
- [ ] kubectl port-forward grafana 3000:3000 → Accessible
- [ ] Prometheus Targets page → Shows all scrape targets UP
- [ ] Prometheus Graph page → Can query metrics (up, container_cpu_usage_seconds_total)
- [ ] Grafana Dashboard → Kubernetes Cluster shows metrics
- [ ] Grafana Dashboard → Application Performance shows metrics
- [ ] Generate high CPU load → Alert triggers
- [ ] Grafana shows alert in UI

### Success Criteria
✓ Prometheus collects metrics from cluster
✓ Grafana visualizes metrics with dashboards
✓ Pre-configured dashboards included
✓ Alert rules configured and working
✓ Users can access monitoring in 2 clicks

---

## FEATURE 4: Jenkins CI/CD Pipeline Integration

### Context
GitHub Actions is good, but Jenkins offers more control. Generate Jenkinsfile for teams using Jenkins.

### Implementation Steps

**Step 1: Generate Jenkinsfile**
```
Location: POST /api/cicd endpoint in backend/server.js
Task: Generate Jenkinsfile (Declarative Pipeline)

Generated Jenkinsfile:

pipeline {
  agent any
  
  environment {
    REGISTRY = "shopops-app"
    IMAGE_TAG = "${BUILD_NUMBER}"
    AWS_REGION = "ap-south-1"
  }
  
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }
    
    stage('Build') {
      steps {
        sh 'npm install'
        sh 'npm run build'
      }
    }
    
    stage('Test') {
      steps {
        sh 'npm test'
      }
    }
    
    stage('Docker Build') {
      steps {
        sh 'docker build -t ${REGISTRY}:${IMAGE_TAG} .'
      }
    }
    
    stage('Docker Push') {
      steps {
        sh 'docker push ${REGISTRY}:${IMAGE_TAG}'
      }
    }
    
    stage('Deploy to K8s') {
      steps {
        sh 'kubectl set image deployment/shopops-app shopops-app=${REGISTRY}:${IMAGE_TAG}'
        sh 'kubectl rollout status deployment/shopops-app'
      }
    }
    
    stage('Health Check') {
      steps {
        sh 'curl -f http://shopops-app:3000/health || exit 1'
      }
    }
  }
  
  post {
    failure {
      echo 'Pipeline failed - rolling back'
      sh 'kubectl rollout undo deployment/shopops-app'
    }
    always {
      cleanWs()
    }
  }
}

Requirements:
- Parallel jobs where possible
- Proper error handling
- Rollback on failure
- Email/Slack notifications (optional)
```

**Step 2: Add Jenkins Credentials Setup Instructions**
```
Location: Generated DEPLOYMENT.md
Task: Document Jenkins setup

Instructions:
1. Install Jenkins (Docker: docker run -d -p 8080:8080 jenkins/jenkins:latest)
2. Install plugins: Docker, Kubernetes, GitHub
3. Create credentials:
   - AWS credentials (for Docker push)
   - GitHub token (for webhook)
   - Kubernetes config (for deployment)
4. Create new Pipeline job
5. Point to repository URL
6. Set script path: Jenkinsfile
7. Setup webhook: GitHub repo → Jenkins

Requirements:
- Step-by-step setup guide
- Troubleshooting section
- Credential scoping best practices
```

**Step 3: Add GitHub Webhook Integration**
```
Location: Jenkinsfile and documentation
Task: Document webhook setup

Webhook URL: http://your-jenkins:8080/github-webhook/

In GitHub repo settings:
1. Settings → Webhooks
2. Payload URL: http://jenkins-server:8080/github-webhook/
3. Content type: application/json
4. Events: Push, Pull requests
5. Active: Yes

Requirements:
- Clear instructions for webhook setup
- Test webhook functionality
- Troubleshoot webhook failures
```

**Step 4: Add Alternative CI/CD Platforms**
```
Location: POST /api/cicd endpoint
Task: Generate pipeline configs for multiple platforms

Support:
1. Jenkinsfile (Declarative)
2. GitHub Actions (YAML)
3. GitLab CI (YAML) - optional
4. CircleCI config.yml - optional

User selects platform in Step 8 of wizard
System generates appropriate pipeline file

Requirements:
- All platforms have same stages
- Easy to switch between platforms
- Platform-specific best practices
```

**Step 5: Add Pipeline Monitoring Dashboard**
```
Location: Frontend
Task: Show pipeline status in dashboard

Display:
- Last 5 build results (Pass/Fail)
- Build duration trends
- Branch status (main, develop, etc.)
- Failed test details (if available)
- Deployment status

Requirements:
- Real-time updates via Jenkins API
- Clear pass/fail indicators
- Link to Jenkins job details
```

### Testing Checklist
- [ ] Generate YAML → Verify Jenkinsfile in output
- [ ] Jenkinsfile has valid syntax (use Jenkins linter)
- [ ] Deploy Jenkins locally
- [ ] Create Jenkins job from generated Jenkinsfile
- [ ] Setup GitHub webhook
- [ ] Push to GitHub → Webhook triggers Jenkins
- [ ] Jenkins checkout stage passes
- [ ] Jenkins build stage passes
- [ ] Jenkins test stage passes
- [ ] Jenkins docker build stage passes
- [ ] Jenkins docker push stage passes (if registry configured)
- [ ] Jenkins deploy stage updates K8s
- [ ] Jenkins health check succeeds
- [ ] Failed test → Rollback triggered
- [ ] Jenkins dashboard shows all builds

### Success Criteria
✓ Jenkinsfile generated with all stages
✓ Jenkins integrates with GitHub
✓ Pipeline triggers on push (no manual trigger needed)
✓ All stages execute and report status
✓ Failure triggers automatic rollback

---

## FEATURE 5: Docker Image Registry Integration (ECR)

### Context
Currently, Docker images are built locally. For production, push to registry (AWS ECR, Docker Hub, etc.).

### Implementation Steps

**Step 1: Add ECR Repository to Generated Terraform**
```
Location: POST /api/terraform endpoint
Task: Generate ECR repository resource

Generated code:

resource "aws_ecr_repository" "shopops_app" {
  name                 = "shopops-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true  # Security scanning
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "shopops-app"
  }
}

resource "aws_ecr_lifecycle_policy" "shopops_app" {
  repository = aws_ecr_repository.shopops_app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus     = "any"
        countType     = "imageCountMoreThan"
        countNumber   = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

output "ecr_repository_url" {
  value = aws_ecr_repository.shopops_app.repository_url
}

Requirements:
- Image scanning enabled (vulnerability detection)
- Lifecycle policy to prevent storage bloat
- Output repository URL for use in K8s
```

**Step 2: Update GitHub Actions to Push to ECR**
```
Location: POST /api/cicd endpoint
Task: Add ECR push step to GitHub Actions workflow

Generated GitHub Actions step:

- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v1
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ap-south-1

- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v1

- name: Build, tag, and push image to Amazon ECR
  env:
    ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
    ECR_REPOSITORY: shopops-app
    IMAGE_TAG: ${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

Requirements:
- Push with commit SHA as tag
- Also push as "latest"
- Secrets configured in GitHub (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
```

**Step 3: Update K8s Deployment to Pull from ECR**
```
Location: POST /api/k8s endpoint
Task: Modify Deployment image to use ECR URL

Generated Deployment:

spec:
  containers:
  - name: app
    image: <account>.dkr.ecr.ap-south-1.amazonaws.com/shopops-app:latest
    imagePullPolicy: Always  # Pull latest on every deploy
    ports:
    - containerPort: 3000

imagePullSecrets:
- name: ecr-secret  # For private repos

Requirements:
- Use ECR URL format
- imagePullPolicy: Always for automatic updates
- Reference to imagePullSecret for authentication
```

**Step 4: Generate imagePullSecret for K8s**
```
Location: K8s generation
Task: Generate Secret for ECR authentication

Generated instructions:

# Create ECR credentials
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.ap-south-1.amazonaws.com

# Create K8s secret
kubectl create secret docker-registry ecr-secret \
  --docker-server=<account>.dkr.ecr.ap-south-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region ap-south-1) \
  --docker-email=<email>

Requirements:
- Clear instructions for generating credentials
- Secret stored as Kubernetes secret
- Deployment references imagePullSecret
```

**Step 5: Add Image Scanning & Vulnerability Reporting**
```
Location: CI/CD pipeline
Task: Scan image for vulnerabilities before push

For GitHub Actions:

- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.ECR_REGISTRY }}/${{ env.ECR_REPOSITORY }}:${{ env.IMAGE_TAG }}
    format: sarif
    output: trivy-results.sarif

- name: Upload Trivy results to GitHub Security tab
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: trivy-results.sarif

Requirements:
- Image scanned before push to registry
- Vulnerabilities reported in GitHub
- Pipeline fails if CRITICAL vulnerabilities found
```

### Testing Checklist
- [ ] Generate Terraform → Verify ECR resource included
- [ ] terraform apply → ECR repository created in AWS
- [ ] AWS ECR Console → Repository visible
- [ ] Generate GitHub Actions → Verify ECR push step included
- [ ] Push code to GitHub → Actions builds and pushes image
- [ ] AWS ECR Console → Image appears with correct tags
- [ ] Generate K8s → Deployment uses ECR URL
- [ ] kubectl apply → imagePullSecret created
- [ ] kubectl apply → Pod pulls image from ECR successfully
- [ ] Pod running from ECR image → App accessible
- [ ] Update Dockerfile → Push code → New image in ECR
- [ ] kubectl set image → New image deployed → App updated
- [ ] Trivy scanning → Vulnerabilities detected and reported

### Success Criteria
✓ ECR repository auto-created
✓ GitHub Actions pushes images to ECR
✓ K8s pulls images from ECR
✓ Image scanning enabled
✓ Automatic vulnerability reporting

---

## FEATURE 6: Mobile Responsive Design

### Context
Current UI is desktop-optimized. Mobile users need responsive layout.

### Implementation Steps

**Step 1: Add Mobile Breakpoints**
```
Location: src/stitches.config.js and component styles
Task: Define responsive breakpoints

breakpoints:
- mobile: 0px (default)
- tablet: 768px
- desktop: 1024px
- wide: 1440px

Example responsive component:

const StyledCard = styled('div', {
  padding: '$md',
  fontSize: '$base',
  
  '@tablet': {
    padding: '$lg',
    fontSize: '$lg',
  },
  
  '@desktop': {
    padding: '$xl',
    fontSize: '$xl',
  },
})

Requirements:
- Consistent breakpoints across project
- Mobile-first approach
- Touch-friendly sizing (44px minimum)
```

**Step 2: Update Wizard Steps for Mobile**
```
Location: src/screens/* files
Task: Make wizard responsive

Changes:
- Stack layout vertically on mobile
- Reduce code editor height on mobile (scrollable)
- Hide/collapse optional sections on mobile
- Make buttons full-width on mobile
- Reduce font sizes appropriately

Example:

const WizardContainer = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$md',
  
  '@tablet': {
    flexDirection: 'row',
    gap: '$lg',
  },
})

Requirements:
- Readable on 375px (iPhone SE)
- Usable on 768px (iPad)
- Optimal on 1024px+ (desktop)
```

**Step 3: Update Code Editors for Mobile**
```
Location: Code editor components
Task: Handle code display on small screens

Changes:
- Make editor scrollable horizontally (code is long)
- Reduce font size on mobile (for readability)
- Add tab to switch between files on mobile
- Show line numbers on desktop only
- Syntax highlighting preserved on mobile

Example:

const CodeEditor = styled('pre', {
  fontSize: '$sm',
  overflowX: 'auto',
  
  '@desktop': {
    fontSize: '$base',
  },
})

Requirements:
- Code visible without horizontal scroll (mostly)
- Syntax highlighting preserved
- Copy button easily accessible
```

**Step 4: Make Dashboard Mobile-Friendly**
```
Location: EnhancedDashboardScreen component
Task: Optimize metrics display for mobile

Changes:
- Stack metrics vertically on mobile
- Full-width charts on mobile
- Touch-friendly legend tapping
- Collapse metric details on mobile (tap to expand)
- Larger tap targets for all buttons

Requirements:
- Charts readable on mobile
- Metrics visible without pinch-zoom
- Interaction works with touch events
```

**Step 5: Add Mobile Navigation**
```
Location: App.jsx or Layout component
Task: Improve navigation on mobile

Changes:
- Hamburger menu on mobile (< 768px)
- Slide-out sidebar
- Back button on mobile (not desktop)
- Progress indicator for wizard steps (mobile: number, desktop: name)

Requirements:
- Easy navigation without external tools
- Clear indication of current step
- Back button to previous step
```

**Step 6: Test Touch Interactions**
```
Location: All interactive components
Task: Ensure touch-friendly interactions

Changes:
- Button minimum size: 44x44px
- Input field minimum size: 44px height
- Remove hover-only UI (hover doesn't work on touch)
- Proper touch feedback (visual highlight)

Requirements:
- All buttons touchable without magnifying glass
- Form inputs easily tappable
- Visual feedback on touch
```

### Testing Checklist
- [ ] Open UI on iPhone/mobile browser
- [ ] Wizard visible without horizontal scroll
- [ ] Buttons easily tappable (44px+)
- [ ] Code editor scrollable (not cut off)
- [ ] Dashboard metrics stacked vertically
- [ ] Menu hamburger visible on mobile
- [ ] Tap hamburger → Menu opens
- [ ] Tap menu item → Navigate
- [ ] Responsive on 375px (iPhone SE)
- [ ] Responsive on 768px (iPad)
- [ ] Responsive on 1024px (laptop)
- [ ] No unintended horizontal scrolling
- [ ] Text readable (no tiny fonts)
- [ ] Touch feedback visible (highlight/animation)
- [ ] All features accessible on mobile

### Success Criteria
✓ Mobile-first responsive design
✓ Touch-friendly interface (44px buttons)
✓ No horizontal scrolling on mobile
✓ Hamburger menu for navigation
✓ Charts/metrics adapted for mobile

---

## FEATURE 7: Unit Tests & Code Coverage

### Context
No tests currently. Add Jest/Vitest to ensure reliability.

### Implementation Steps

**Step 1: Setup Jest (Frontend)**
```
Location: Frontend root directory
Task: Initialize Jest testing framework

Install:
npm install --save-dev jest @testing-library/react @testing-library/jest-dom vitest

Create jest.config.js:

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

Create src/setupTests.js:

import '@testing-library/jest-dom';

Requirements:
- Jest configured for React
- Coverage thresholds set to 70%+
- Test files in __tests__ or .test.js convention
```

**Step 2: Write Frontend Component Tests**
```
Location: src/__tests__/ directory
Task: Test critical components

Test 1: Welcome Screen (src/__tests__/Welcome.test.jsx)

import { render, screen } from '@testing-library/react';
import Welcome from '../screens/Welcome';

describe('Welcome Screen', () => {
  test('renders title', () => {
    render(<Welcome />);
    expect(screen.getByText('ShopOps Infra')).toBeInTheDocument();
  });

  test('renders three buttons', () => {
    render(<Welcome />);
    expect(screen.getByRole('button', { name: /Ask AI First/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Interactive Wizard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Demo Setup/i })).toBeInTheDocument();
  });

  test('clicking Start Wizard navigates', () => {
    render(<Welcome />);
    const button = screen.getByRole('button', { name: /Start Interactive Wizard/i });
    fireEvent.click(button);
    // Assert navigation happened
  });
});

Test 2: Wizard Steps (src/__tests__/WizardStep.test.jsx)

describe('Wizard Step 1: Business Type', () => {
  test('displays 4 business type options', () => {
    render(<WizardStep1 />);
    expect(screen.getByText('E-commerce')).toBeInTheDocument();
    expect(screen.getByText('SaaS')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  test('selecting option highlights it', () => {
    render(<WizardStep1 />);
    const ecommerceButton = screen.getByRole('button', { name: /E-commerce/i });
    fireEvent.click(ecommerceButton);
    expect(ecommerceButton).toHaveClass('selected');
  });

  test('Next button disabled without selection', () => {
    render(<WizardStep1 />);
    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  test('Next button enabled after selection', () => {
    render(<WizardStep1 />);
    const ecommerceButton = screen.getByRole('button', { name: /E-commerce/i });
    fireEvent.click(ecommerceButton);
    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).not.toBeDisabled();
  });
});

Requirements:
- Component renders correctly
- User interactions work
- Navigation functions
- Error states handled
- Accessibility features present
```

**Step 3: Write Backend API Tests**
```
Location: backend/__tests__/ directory
Task: Test API endpoints

Test 1: Health Check (backend/__tests__/health.test.js)

const request = require('supertest');
const app = require('../server');

describe('Health Check', () => {
  test('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});

Test 2: Architecture Generation (backend/__tests__/architecture.test.js)

describe('POST /api/architecture', () => {
  test('generates architecture for ecommerce', async () => {
    const res = await request(app)
      .post('/api/architecture')
      .send({ businessType: 'ecommerce', scale: 'growth' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('tier');
    expect(res.body).toHaveProperty('resources');
    expect(res.body).toHaveProperty('estimatedCost');
  });

  test('rejects invalid business type', async () => {
    const res = await request(app)
      .post('/api/architecture')
      .send({ businessType: 'invalid', scale: 'growth' });
    
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

Test 3: Terraform Generation (backend/__tests__/terraform.test.js)

describe('POST /api/terraform', () => {
  test('generates valid Terraform HCL', async () => {
    const res = await request(app)
      .post('/api/terraform')
      .send({ provider: 'aws', tier: 'growth' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('hcl');
    expect(res.body.hcl).toContain('provider "aws"');
    expect(res.body.hcl).toContain('resource');
  });

  test('terraform code validates', async () => {
    // Validate HCL syntax programmatically
    const res = await request(app)
      .post('/api/terraform')
      .send({ provider: 'aws', tier: 'growth' });
    
    // Could use terraform-js-parser or similar
    const isValidHCL = validateTerraformHCL(res.body.hcl);
    expect(isValidHCL).toBe(true);
  });
});

Requirements:
- Test all API endpoints
- Test error handling
- Test input validation
- Test response format
- Aim for 70%+ code coverage
```

**Step 4: Write Integration Tests**
```
Location: backend/__tests__/integration/
Task: Test workflows across multiple endpoints

Test: Full Infrastructure Generation Flow

describe('Integration: Full Infrastructure Generation', () => {
  test('complete workflow: wizard → generate → validate', async () => {
    // Step 1: Get architecture
    const archRes = await request(app)
      .post('/api/architecture')
      .send({ businessType: 'saas', scale: 'growth' });
    
    expect(archRes.statusCode).toBe(200);
    const tier = archRes.body.tier;

    // Step 2: Generate Terraform
    const tfRes = await request(app)
      .post('/api/terraform')
      .send({ provider: 'aws', tier });
    
    expect(tfRes.statusCode).toBe(200);
    const hcl = tfRes.body.hcl;

    // Step 3: Generate Dockerfile
    const dockerRes = await request(app)
      .post('/api/dockerfile')
      .send({ language: 'nodejs' });
    
    expect(dockerRes.statusCode).toBe(200);
    const dockerfile = dockerRes.body.content;

    // Step 4: Generate K8s
    const k8sRes = await request(app)
      .post('/api/k8s')
      .send({ tier });
    
    expect(k8sRes.statusCode).toBe(200);
    const manifests = k8sRes.body.manifests;

    // Verify all components generated
    expect(hcl).toBeDefined();
    expect(dockerfile).toBeDefined();
    expect(manifests).toBeDefined();
  });
});

Requirements:
- Test complete user workflows
- Verify data flows between endpoints
- Test error recovery
- Test edge cases
```

**Step 5: Add Code Coverage Reporting**
```
Location: GitHub Actions workflow
Task: Generate and report code coverage

In .github/workflows/ci-cd.yml:

- name: Run tests with coverage
  run: npm test -- --coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella

- name: Check coverage thresholds
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 70" | bc -l) )); then
      echo "Coverage ${COVERAGE}% below 70% threshold"
      exit 1
    fi

Requirements:
- Coverage report generated on every push
- Coverage badge in README
- Thresholds enforced (70%+)
- Codecov integration (optional)
```

**Step 6: Add Test Scripts to package.json**
```
Location: package.json
Task: Add convenient test commands

Scripts:

"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage",
"test:verbose": "jest --verbose",

backend/package.json:

"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage",

Usage:
npm test            # Run all tests once
npm run test:watch  # Re-run on file changes
npm run test:coverage  # Generate coverage report
```

### Testing Checklist
- [ ] Jest installed and configured
- [ ] setupTests.js created
- [ ] Component tests written (Welcome, Wizard steps)
- [ ] API tests written (health, architecture, terraform, etc.)
- [ ] Integration tests written (full workflows)
- [ ] Tests run successfully: npm test
- [ ] Coverage report generated: npm run test:coverage
- [ ] Coverage >= 70% for lines, functions, branches
- [ ] Tests run in CI/CD on every push
- [ ] Failed tests block merge/deploy
- [ ] Coverage badge in README

### Success Criteria
✓ 70%+ code coverage
✓ All critical paths tested
✓ Tests run automatically in CI/CD
✓ Failed tests prevent deployment
✓ Coverage reports available

---

## Implementation Order (Recommended)

**Week 1**: Test & verify existing features (do NOT start coding yet)
**Week 2**: Feature 1 (Remote State) + Feature 2 (ConfigMaps/Secrets)
**Week 3**: Feature 3 (Prometheus/Grafana)
**Week 4**: Feature 4 (Jenkins) + Feature 5 (ECR)
**Week 5**: Feature 6 (Mobile) + Feature 7 (Tests)

Total estimated time: 3-4 weeks of focused development

---

## How to Use This Document with AI IDE

Copy and paste each feature section into your AI IDE prompt:

**Example Prompt for Claude/Copilot**:
```
I'm implementing Terraform Remote State for my ShopOps Infra project.

Here's the feature description and requirements:

[PASTE FEATURE 1 SECTION HERE]

My current code is in backend/server.js at the POST /api/terraform endpoint.

Can you help me implement this feature by:
1. Modifying the Terraform generation logic
2. Creating the backend.tf template
3. Updating the deployment flow
4. Adding the frontend display

Please provide code that I can directly integrate into my project.
```

Or use this generic prompt structure:

```
Feature: [FEATURE NAME]

Context: [CONTEXT FROM DOCUMENT]

Requirements: [REQUIREMENTS FROM DOCUMENT]

Files to modify:
- [FILE 1]
- [FILE 2]
- [FILE 3]

Please implement this feature following these requirements.
Provide working code that I can integrate immediately.
```

---

## Success Criteria for All Features

```
TERRAFORM REMOTE STATE:
✓ State stored in S3 (not local)
✓ DynamoDB locking prevents conflicts
✓ Users see state location in UI

CONFIGMAPS & SECRETS:
✓ ConfigMap stores app configuration
✓ Secret stores sensitive data
✓ Deployment injects both as env vars

PROMETHEUS & GRAFANA:
✓ Prometheus collects metrics
✓ Grafana visualizes with dashboards
✓ Pre-configured alert rules work

JENKINS CI/CD:
✓ Jenkinsfile generated
✓ Webhook triggers on push
✓ All stages execute successfully

DOCKER IMAGE REGISTRY:
✓ ECR repository created
✓ GitHub Actions pushes to ECR
✓ K8s pulls from ECR successfully

MOBILE RESPONSIVE:
✓ Works on 375px (mobile)
✓ Works on 768px (tablet)
✓ Works on 1024px+ (desktop)
✓ Touch-friendly (44px buttons)

UNIT TESTS:
✓ 70%+ code coverage
✓ Tests run in CI/CD
✓ Failed tests block deployment
```

---

That's your complete implementation plan for all 7 missing features.

**Use this with your AI IDE to code faster.**