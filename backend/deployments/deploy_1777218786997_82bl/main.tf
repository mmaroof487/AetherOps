Here's the starting part of your Terraform configuration file (HCL):
```hcl
provider "aws" {
  region = var.region_mumbai
}
variable "vpc_cidr_block" {}
variable "public_subnet1_cidr_block" {}
variable "private_subnet2_cidr_block" {}
```
This part sets up the AWS provider with our custom region and defines some variables for CIDR blocks. We'll use these later in a bit to define more resources (like VPC, S3 buckets etc). 

Continuing from there: This is where you start defining your infrastructure components using `resource` block after that we will create all of the AWS services like RDS instance for database and an s3 bucket which would be used as data storage.  
```hcl
data "aws_region" "current" {}
local-exec {
  command = ["terraform", "output", "-json"]
} >> json <<< ${var."${[for k, v in keys(toself().modules)][0]}.value.vpc"}   # get the output of first module and convert to JSON format (Terraform outputs are stored as a map)  We use this for referencing resources created by different modules
output "public_subnet1" {
    value = json["privateSubnets"].split(";")[0]                            # access data using keys in the output of first module and split into array. This should work if all public subnets are on one private subnet  (this will depend how your terraform files were set up)  
}                             ... continue similar pattern for other resources, like RDS instance or S3 bucket etc...    And provide outputs to refer these later in the code using `var.<resource_name>` and display them as needed with:`terraform output -raw <output-variable>```  For example if you have created an s3 buckets we could use it like this :
S3 Bucket ARN =  var.(s3buckupet)    #you can get the arn using terraform outputs. It would be something similar to "arn:aws:s3:::your-BucketName"  Then you fetch data from s3 bucket, it could use `terraform import` command if your infrastructure code is not ready for that yet
```hcl   ... repeat the previous pattern until all resources are created. And also remember to include modules in a way they require (like each module should be required as and when needed). Terraform will handle dependencies between them, so you only have one VPC setup at any given time which might not seem necessary but could save lots of trouble if your infrastructure grows larger over the course of months.