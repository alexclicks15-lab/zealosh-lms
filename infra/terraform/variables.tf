# Zealosh LMS — Terraform Staging Infrastructure Variables

variable "environment" {
  type        = string
  description = "Target deployment environment (staging, production)"
  default     = "staging"
}

variable "region" {
  type        = string
  description = "Target cloud region (e.g. blr1 for Bangalore/India, fra1 for Frankfurt, nyc3 for New York)"
  default     = "blr1"
}

variable "app_instance_size" {
  type        = string
  description = "Droplet/Instance type for Server 1 (Next.js Hub + Moodle + Postgres + Redis)"
  default     = "s-4vcpu-16gb"
}

variable "media_instance_size" {
  type        = string
  description = "Droplet/Instance type for Server 2 (BigBlueButton 4.0 Dedicated WebRTC Media Node: 8 vCPUs, 16GB RAM, 500GB disk)"
  default     = "c-8" # 8 Dedicated vCPUs, 16GB RAM
}

variable "ssh_key_fingerprints" {
  type        = list(string)
  description = "List of SSH key fingerprints or IDs authorized to access staging instances"
  default     = []
}

variable "allowed_admin_ips" {
  type        = list(string)
  description = "Approved operator CIDR blocks permitted to access SSH (port 22)"
  default     = ["0.0.0.0/0"] # Restrict to specific admin office/VPN CIDRs in production
}

variable "domain_name" {
  type        = string
  description = "Root domain for staging endpoints"
  default     = "staging.zealosh.com"
}
