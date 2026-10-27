terraform {
  required_version = ">= 1.5.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.30"
    }
  }
}

# 1. Staging VPC Private Network
resource "digitalocean_vpc" "zealosh_vpc" {
  name        = "zealosh-${var.environment}-vpc"
  region      = var.region
  ip_range    = "10.10.0.0/16"
  description = "Isolated private network for Zealosh LMS staging infrastructure"
}

# 2. Server 1: Application & LMS Engine Host (Next.js Hub + Moodle + Postgres + Redis)
resource "digitalocean_droplet" "app_host" {
  name       = "zealosh-${var.environment}-app"
  region     = var.region
  size       = var.app_instance_size
  image      = "ubuntu-22-04-x64"
  vpc_uuid   = digitalocean_vpc.zealosh_vpc.id
  ssh_keys   = var.ssh_key_fingerprints
  monitoring = true
  backups    = true
  user_data  = file("${path.module}/../cloud-init/app-server.cloud-init.yaml")

  tags = [
    "zealosh",
    var.environment,
    "app-hub",
    "moodle"
  ]
}

# 3. Server 2: Live Virtual Classroom Media Server (BigBlueButton 4.0 Baseline)
# Dedicated WebRTC media host: 8 vCPUs, 16GB RAM, 500GB disk for recordings
resource "digitalocean_droplet" "media_host" {
  name       = "zealosh-${var.environment}-media"
  region     = var.region
  size       = var.media_instance_size
  image      = "ubuntu-24-04-x64"
  vpc_uuid   = digitalocean_vpc.zealosh_vpc.id
  ssh_keys   = var.ssh_key_fingerprints
  monitoring = true
  backups    = false # Real-time media node; recordings backed up to S3/R2
  user_data  = file("${path.module}/../cloud-init/media-server.cloud-init.yaml")

  tags = [
    "zealosh",
    var.environment,
    "bigbluebutton",
    "webrtc"
  ]
}
