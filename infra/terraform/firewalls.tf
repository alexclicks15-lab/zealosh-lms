# Zealosh LMS — Staging Security Groups & Firewall Invariants

# 1. Server 1 Firewall (App & Moodle Host)
resource "digitalocean_firewall" "app_firewall" {
  name = "zealosh-${var.environment}-app-firewall"

  droplet_ids = [digitalocean_droplet.app_host.id]

  # Allow inbound HTTP / HTTPS
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Allow SSH restricted to operator CIDRs
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.allowed_admin_ips
  }

  # Allow all internal private traffic from within the staging VPC
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_addresses = [digitalocean_vpc.zealosh_vpc.ip_range]
  }

  # Outbound Rules (Allow all outbound for apt, docker registries, and external APIs)
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# 2. Server 2 Firewall (BigBlueButton Media Host)
resource "digitalocean_firewall" "media_firewall" {
  name = "zealosh-${var.environment}-media-firewall"

  droplet_ids = [digitalocean_droplet.media_host.id]

  # Inbound HTTP / HTTPS (for client UI, signaling, and Let's Encrypt renewal)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Inbound WebRTC RTP media stream UDP port range
  inbound_rule {
    protocol         = "udp"
    port_range       = "16384-32768"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Inbound SSH restricted to operator CIDRs
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.allowed_admin_ips
  }

  # Inbound private traffic from staging VPC
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_addresses = [digitalocean_vpc.zealosh_vpc.ip_range]
  }

  # Outbound
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
