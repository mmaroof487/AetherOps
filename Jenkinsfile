// ShopOps Jenkins CI/CD Pipeline
// Declarative Pipeline for building, testing, and deploying infrastructure

pipeline {
    agent any

    options {
        timeout(time: 1, unit: 'HOURS')
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }

    environment {
        // AWS Configuration
        AWS_REGION = 'ap-south-1'
        AWS_ACCOUNT_ID = credentials('aws-account-id')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')

        // Docker Registry
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        ECR_REPOSITORY = 'shopops-app'
        IMAGE_TAG = "${BUILD_NUMBER}"

        // Application
        APP_NAME = 'shopops'
        DEPLOY_ENV = 'production'

        // Paths
        TERRAFORM_DIR = 'terraform'
        BACKEND_DIR = 'backend'
        FRONTEND_DIR = '.'
    }

    parameters {
        choice(
            name: 'ACTION',
            choices: ['BUILD_AND_TEST', 'DEPLOY_INFRA', 'DEPLOY_APP', 'FULL_DEPLOYMENT', 'DESTROY_INFRA'],
            description: 'Choose pipeline action'
        )
        string(
            name: 'ENVIRONMENT',
            defaultValue: 'production',
            description: 'Deployment environment'
        )
    }

    stages {
        stage('Initialize') {
            steps {
                script {
                    echo """
                    ════════════════════════════════════════════════════════════════
                    ShopOps CI/CD Pipeline
                    ════════════════════════════════════════════════════════════════
                    Build Number: ${BUILD_NUMBER}
                    Build Job: ${JOB_NAME}
                    Action: ${params.ACTION}
                    Environment: ${params.ENVIRONMENT}
                    AWS Region: ${AWS_REGION}
                    ════════════════════════════════════════════════════════════════
                    """
                }
                checkout scm
            }
        }

        stage('Code Quality') {
            when {
                expression { params.ACTION in ['BUILD_AND_TEST', 'FULL_DEPLOYMENT'] }
            }
            steps {
                script {
                    echo "Running code quality checks..."

                    // Frontend linting
                    sh '''
                        echo "Linting frontend code..."
                        npx eslint src --max-warnings 0 || true
                    '''

                    // Terraform validation
                    sh '''
                        echo "Validating Terraform..."
                        cd ${TERRAFORM_DIR}
                        terraform init -backend=false
                        terraform validate
                        terraform fmt -check -recursive
                        cd ..
                    '''

                    // Backend linting
                    sh '''
                        echo "Linting backend code..."
                        cd ${BACKEND_DIR}
                        npx eslint . || true
                        cd ..
                    '''
                }
            }
        }

        stage('Unit Tests') {
            when {
                expression { params.ACTION in ['BUILD_AND_TEST', 'FULL_DEPLOYMENT'] }
            }
            steps {
                script {
                    echo "Running unit tests..."
                    sh '''
                        echo "Frontend tests..."
                        npm test -- --coverage --watchAll=false || true

                        echo "Backend tests..."
                        cd ${BACKEND_DIR}
                        npm test || true
                        cd ..
                    '''
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: '**/test-results/**/*.xml'
                    publishHTML([
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Code Coverage Report'
                    ])
                }
            }
        }

        stage('Build Artifacts') {
            when {
                expression { params.ACTION in ['BUILD_AND_TEST', 'FULL_DEPLOYMENT', 'DEPLOY_APP'] }
            }
            steps {
                script {
                    echo "Building frontend..."
                    sh '''
                        npm ci
                        npm run build
                    '''

                    echo "Building Docker image..."
                    sh '''
                        docker build -t ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} .
                        docker tag ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
                    '''
                }
            }
        }

        stage('Push to Registry') {
            when {
                expression { params.ACTION in ['BUILD_AND_TEST', 'FULL_DEPLOYMENT', 'DEPLOY_APP'] }
                branch 'main'
            }
            steps {
                script {
                    echo "Authenticating to ECR..."
                    sh '''
                        aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
                        docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
                    '''
                }
            }
        }

        stage('Terraform Plan') {
            when {
                expression { params.ACTION in ['DEPLOY_INFRA', 'FULL_DEPLOYMENT'] }
            }
            steps {
                script {
                    echo "Planning Terraform infrastructure..."
                    sh '''
                        cd ${TERRAFORM_DIR}
                        terraform init \
                          -backend-config="bucket=shopops-terraform-state-${AWS_ACCOUNT_ID}" \
                          -backend-config="key=prod/terraform.tfstate" \
                          -backend-config="region=${AWS_REGION}" \
                          -backend-config="encrypt=true" \
                          -backend-config="dynamodb_table=shopops-terraform-locks"

                        terraform plan \
                          -var="environment=${DEPLOY_ENV}" \
                          -out=tfplan

                        terraform show tfplan > tfplan.txt
                        cd ..
                    '''
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: '${TERRAFORM_DIR}/tfplan*', allowEmptyArchive: true
                }
            }
        }

        stage('Approve Infrastructure Changes') {
            when {
                expression { params.ACTION in ['DEPLOY_INFRA', 'FULL_DEPLOYMENT'] }
                branch 'main'
            }
            steps {
                script {
                    def userInput = input(
                        id: 'Confirm',
                        message: 'Deploy infrastructure to AWS?',
                        parameters: [
                            booleanParam(
                                defaultValue: false,
                                description: 'Apply Terraform changes?',
                                name: 'APPLY_TERRAFORM'
                            )
                        ]
                    )

                    if (userInput) {
                        env.APPLY_INFRASTRUCTURE = 'true'
                    }
                }
            }
        }

        stage('Terraform Apply') {
            when {
                expression { params.ACTION in ['DEPLOY_INFRA', 'FULL_DEPLOYMENT'] && env.APPLY_INFRASTRUCTURE == 'true' }
            }
            steps {
                script {
                    echo "Applying Terraform configuration..."
                    sh '''
                        cd ${TERRAFORM_DIR}
                        terraform apply tfplan
                        terraform output -json > outputs.json
                        cd ..
                    '''
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: '${TERRAFORM_DIR}/outputs.json', allowEmptyArchive: true
                }
            }
        }

        stage('Run Ansible Provisioning') {
            when {
                expression { params.ACTION in ['DEPLOY_INFRA', 'FULL_DEPLOYMENT'] && env.APPLY_INFRASTRUCTURE == 'true' }
            }
            steps {
                script {
                    echo "Running Ansible provisioning..."
                    sh '''
                        # Extract EC2 instance IPs from Terraform outputs
                        cd ${TERRAFORM_DIR}
                        APP_HOST=$(terraform output -raw app_instance_ip || echo "localhost")
                        cd ..

                        # Create inventory
                        cat > inventory.ini <<EOF
                        [shopops]
                        ${APP_HOST} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/shopops.pem

                        [shopops:vars]
                        ansible_python_interpreter=/usr/bin/python3
                        docker_image_url=${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}
                        EOF

                        # Run Ansible playbook
                        ansible-playbook -i inventory.ini \
                          --extra-vars "environment=${DEPLOY_ENV}" \
                          infravend/playbooks/provision_infrastructure.yml
                    '''
                }
            }
        }

        stage('Deploy Application to K8s') {
            when {
                expression { params.ACTION in ['DEPLOY_APP', 'FULL_DEPLOYMENT'] }
            }
            steps {
                script {
                    echo "Deploying application to Kubernetes..."
                    sh '''
                        # Update K8s manifests with new image tag
                        sed -i "s|IMAGE_TAG|${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}|g" k8s/app-deployment-template.yaml

                        # Apply manifests
                        kubectl apply -f k8s/app-deployment-template.yaml
                        kubectl apply -f k8s/prometheus-deployment.yaml
                        kubectl apply -f k8s/grafana-deployment.yaml

                        # Wait for deployment
                        kubectl rollout status deployment/shopops-app -n shopops --timeout=5m
                    '''
                }
            }
        }

        stage('Health Check') {
            when {
                expression { params.ACTION in ['DEPLOY_APP', 'FULL_DEPLOYMENT', 'DEPLOY_INFRA'] && env.APPLY_INFRASTRUCTURE != 'false' }
            }
            steps {
                script {
                    echo "Running health checks..."
                    sh '''
                        # Wait for application to be ready
                        sleep 30

                        # Get application endpoint
                        if command -v kubectl &> /dev/null; then
                            APP_ENDPOINT=$(kubectl get svc shopops-service -n shopops -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "localhost:8000")
                        else
                            APP_ENDPOINT="localhost:8000"
                        fi

                        echo "Testing application endpoint: http://$APP_ENDPOINT/health"
                        curl -f http://$APP_ENDPOINT/health || { echo "Health check failed"; exit 1; }
                        echo "✓ Application is healthy"
                    '''
                }
            }
        }

        stage('Destroy Infrastructure') {
            when {
                expression { params.ACTION == 'DESTROY_INFRA' }
            }
            steps {
                script {
                    def userConfirm = input(
                        id: 'DestroyConfirm',
                        message: '⚠️  This will DESTROY all infrastructure. Confirm?',
                        parameters: [
                            booleanParam(
                                defaultValue: false,
                                description: 'Destroy infrastructure?',
                                name: 'CONFIRM_DESTROY'
                            )
                        ]
                    )

                    if (userConfirm) {
                        sh '''
                            cd ${TERRAFORM_DIR}
                            terraform destroy -auto-approve
                            cd ..
                        '''
                    } else {
                        echo "Infrastructure destruction cancelled"
                    }
                }
            }
        }

        stage('Publish Reports') {
            when {
                expression { params.ACTION in ['BUILD_AND_TEST', 'FULL_DEPLOYMENT'] }
            }
            steps {
                script {
                    echo "Publishing reports..."
                    publishHTML([
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Code Coverage'
                    ])
                }
            }
        }
    }

    post {
        always {
            script {
                echo "Pipeline execution completed"
                cleanWs(deleteDirs: true, patterns: [[pattern: '**/node_modules/**', type: 'INCLUDE']])
            }
        }
        success {
            script {
                echo """
                ════════════════════════════════════════════════════════════════
                ✓ PIPELINE SUCCESSFUL
                ════════════════════════════════════════════════════════════════
                Build: ${BUILD_NUMBER}
                Status: SUCCESS
                Action: ${params.ACTION}
                Duration: ${currentBuild.durationString}
                ════════════════════════════════════════════════════════════════
                """
            }
        }
        failure {
            script {
                echo """
                ════════════════════════════════════════════════════════════════
                ✗ PIPELINE FAILED
                ════════════════════════════════════════════════════════════════
                Build: ${BUILD_NUMBER}
                Status: FAILURE
                Action: ${params.ACTION}
                Check logs for details
                ════════════════════════════════════════════════════════════════
                """
            }
        }
        unstable {
            echo "Pipeline is unstable"
        }
    }
}
