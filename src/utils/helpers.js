// Utility functions for infrastructure parsing and analysis

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export const AWS_TIPS = {
  'aws_instance':      'Your app server — the computer in the cloud that runs your website 24/7',
  'aws_db_instance':   'Your database — stores all customer orders and accounts securely',
  'aws_vpc':           'Your private network — a fenced plot in the cloud only your app can access',
  'security_group':    'Your firewall — controls exactly who can talk to your server',
  'aws_alb':           'Your traffic manager — spreads visitors across servers so none gets overwhelmed',
  'aws_cloudfront':    'Speed layer — serves your site from servers near your customers',
  'aws_s3_bucket':     'File storage — stores images, documents and backups cheaply',
  'aws_elasticache':   'Speed cache — remembers frequent answers so pages load faster',
  'autoscaling':       'Elastic capacity — automatically adds servers when traffic spikes',
  'storage_encrypted': 'Encryption — data is scrambled so only your app can read it',
  'backup_retention':  'Auto-backups — daily snapshots you can restore from any time',
  'cloudwatch':        'Monitoring — alerts you the moment anything behaves unexpectedly',
}

export const parseSecurityChecks = (terraform = '') => {
  return [
    { label: 'Database encrypted at rest', pass: /storage_encrypted.*true|encrypted.*true/.test(terraform) },
    { label: 'Private network (VPC)', pass: terraform.includes('aws_vpc') },
    { label: 'Firewall rules defined', pass: terraform.includes('security_group') },
    { label: 'Automated backups enabled', pass: /backup_retention_period\s*=\s*[1-9]/.test(terraform) },
    { label: 'Mumbai region (low latency)', pass: terraform.includes('ap-south-1') },
    { label: 'Monitoring configured', pass: terraform.includes('cloudwatch') || terraform.includes('monitoring') },
  ]
}

export const parseCost = (terraform = '') => {
  const match = terraform.match(/estimatedCost['":\s]*([0-9.]+)/)
  return match ? parseFloat(match[1]) : 0
}

export const validateTerraform = (terraform = '') => {
  const checks = {
    hasProvider:   terraform.includes('provider'),
    hasResources:  terraform.includes('resource'),
    hasVPC:        terraform.includes('aws_vpc') || terraform.includes('aws_security_group'),
    hasEncryption: terraform.includes('encrypted') || terraform.includes('kms'),
    hasBackups:    terraform.includes('backup_retention'),
    isValidHCL:    terraform.trim().length > 50 && !terraform.includes('INVALID')
  }
  return {
    valid: Object.values(checks).every(v => v),
    checks
  }
}

export const parseCostBreakdown = (terraform = '') => {
  const breakdown = {
    compute: 0,
    database: 0,
    storage: 0,
    networking: 0,
    monitoring: 0
  }

  if (terraform.includes('t3.micro')) breakdown.compute = 10
  if (terraform.includes('t3.small')) breakdown.compute = 25
  if (terraform.includes('t3.medium')) breakdown.compute = 50
  if (terraform.includes('t3.large')) breakdown.compute = 100

  if (terraform.includes('aws_db_instance')) breakdown.database = 15
  if (terraform.includes('aws_rds')) breakdown.database = 20

  if (terraform.includes('aws_s3_bucket')) breakdown.storage = 5
  if (terraform.includes('aws_ebs')) breakdown.storage = 10

  if (terraform.includes('aws_alb') || terraform.includes('load_balancer')) breakdown.networking = 15
  if (terraform.includes('aws_cloudfront')) breakdown.networking = 25

  if (terraform.includes('cloudwatch') || terraform.includes('prometheus')) breakdown.monitoring = 5

  return breakdown
}

export const parseBenefits = (terraform = '') => {
  return [
    { icon: '🔒', label: 'Security First', pass: /encrypted|security_group|vpc/.test(terraform) },
    { icon: '⚡', label: 'Auto-Scaling', pass: /autoscaling|hpa|scaling/.test(terraform) },
    { icon: '💾', label: 'Automated Backups', pass: /backup_retention|backup_window/.test(terraform) },
    { icon: '📊', label: 'Monitoring Built-in', pass: /cloudwatch|prometheus|monitoring/.test(terraform) },
    { icon: '🌍', label: 'Multi-AZ Availability', pass: /multi_az|availability_zone/.test(terraform) },
    { icon: '🛠', label: 'Infrastructure as Code', pass: /resource|terraform|infrastructure/.test(terraform) },
  ]
}

export const extractK8sInfo = (manifests = '') => {
  const info = {
    hasDeployment: manifests.includes('kind: Deployment'),
    hasService: manifests.includes('kind: Service'),
    hasHPA: manifests.includes('kind: HorizontalPodAutoscaler'),
    hasConfigMap: manifests.includes('kind: ConfigMap'),
    hasSecret: manifests.includes('kind: Secret'),
    replicas: manifests.match(/replicas:\s*(\d+)/)?.[1] || '1',
    image: manifests.match(/image:\s*([^\n]+)/)?.[1] || 'nginx:latest'
  }
  return info
}

export const formatCurrency = (amount, locale = 'en-IN', currency = 'INR') => {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export const estimateAnnualCost = (monthlyCost) => {
  return monthlyCost * 12
}
