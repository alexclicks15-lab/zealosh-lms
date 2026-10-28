output "app_server_public_ip" {
  value       = digitalocean_droplet.app_host.ipv4_address
  description = "Public IPv4 address of Server 1 (Zealosh Core Hub & Moodle Engine)"
}

output "app_server_private_ip" {
  value       = digitalocean_droplet.app_host.ipv4_address_private
  description = "VPC Private IP of Server 1"
}

output "media_server_public_ip" {
  value       = digitalocean_droplet.media_host.ipv4_address
  description = "Public IPv4 address of Server 2 (BigBlueButton Live Classroom)"
}

output "media_server_hostname" {
  value       = "media.${var.domain_name}"
  description = "Canonical FQDN for Server 2 (BigBlueButton Live Classroom)"
}

output "dns_records_required" {
  value = {
    lms_record       = "Create A record for lms.${var.domain_name} pointing to ${digitalocean_droplet.app_host.ipv4_address}"
    media_record     = "Create A record for media.${var.domain_name} pointing to ${digitalocean_droplet.media_host.ipv4_address}"
    classroom_record = "Create A record for media.${var.domain_name} pointing to ${digitalocean_droplet.media_host.ipv4_address}"
  }
  description = "Required DNS A-records to point to the created droplets"
}

output "ssh_connection_commands" {
  value = {
    app_server   = "ssh root@${digitalocean_droplet.app_host.ipv4_address}"
    media_server = "ssh root@${digitalocean_droplet.media_host.ipv4_address}"
  }
  description = "SSH commands for operator access"
}
