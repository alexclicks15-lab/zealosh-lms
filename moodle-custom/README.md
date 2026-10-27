# Zealosh Learning Engine — Moodle 5.3 LTS Customization & OIDC SSO Runbook

This directory contains the custom theme and configuration assets for self-hosting **Moodle Core 5.3 LTS (PHP 8.3 / PostgreSQL 17)** as the **Zealosh Learning Engine**, persisting data to a dedicated Supabase PostgreSQL project.

---

## 1. Directory Structure

```
moodle-custom/
├── theme_zealosh/               # Custom Moodle Theme extending Boost
│   ├── config.php               # Theme configuration and parent declaration
│   ├── version.php              # Plugin metadata ($plugin->requires = 2024042200; Moodle 5.3 LTS ready)
│   ├── lib.php                  # Theme library callbacks
│   ├── lang/en/theme_zealosh.php# English localization strings
│   ├── pix/                     # Authentic brand assets: logo.png (12.9KB) & favicon.png (3.9KB)
│   ├── scss/preset/zealosh.scss # Official brand tokens (#4f8c4c, #3a7536, #252c41)
│   └── templates/navbar.mustache# Branded navigation bar template with authentic logo
└── README.md                    # This documentation runbook
```

---

## 2. Deploying & Activating the Zealosh Theme

### Containerized Deployment (Docker Compose):
The theme is automatically synchronized into the Moodle 5.3 container via `docker-compose.zealosh-platform.yml`:
```yaml
volumes:
  - moodledata_data:/var/moodledata
  - ./moodle-custom/theme_zealosh:/opt/theme_zealosh:ro
```

### Manual Installation on Linux Host:
```bash
cp -r moodle-custom/theme_zealosh /var/www/html/moodle/theme/zealosh
chown -R www-data:www-data /var/www/html/moodle/theme/zealosh
chmod -R 755 /var/www/html/moodle/theme/zealosh
```

### Activation via Moodle Web Interface:
1. Log in to Moodle as an Administrator (`admin`).
2. Navigate to: **Site administration** > **Appearance** > **Themes** > **Theme selector**.
3. Next to **Default**, click **Change theme**.
4. Select **Zealosh Learning Engine Theme** (`zealosh`) and click **Use theme**.
5. Navigate to: **Site administration** > **Development** > **Purge caches** to clear compiled CSS caches.

---

## 3. Configuring OpenID Connect (OIDC) Single Sign-On

Zealosh Core Hub acts as the master OAuth2/OIDC Identity Provider (`/api/oauth/*`).

### Step-by-Step Moodle OAuth2 Service Setup:
1. Log in to Moodle as an Administrator.
2. Navigate to: **Site administration** > **Server** > **OAuth 2 services**.
3. Click **Create custom service**.
4. Fill in the following parameters:
   - **Name:** `Zealosh Core Hub`
   - **Client ID:** `zealosh-moodle`
   - **Client secret:** *(Use value configured in `.env.production`)*
   - **Scopes included in authorization request:** `openid profile email`
   - **Scopes included in token request:** `openid profile email`
   - **Service base URL:** `https://lms.zealosh.com` (or internal network `http://zealosh-hub:3000`)
   - **Show on login page:** **Yes** (renders "Sign in with Zealosh" button)
5. Under **Endpoints**, Moodle will auto-discover endpoints via `/.well-known/openid-configuration`:
   - `authorization_endpoint`: `https://lms.zealosh.com/api/oauth/authorize`
   - `token_endpoint`: `https://lms.zealosh.com/api/oauth/token`
   - `userinfo_endpoint`: `https://lms.zealosh.com/api/oauth/userinfo`
6. Under **User field mappings**:
   - `email` -> `email`
   - `name` -> `firstname`
   - `sub` -> `idnumber`
   - `preferred_username` -> `username`
7. Click **Save changes**.

### Enabling OAuth 2 Authentication Plugin:
1. Navigate to: **Site administration** > **Plugins** > **Authentication** > **Manage authentication**.
2. Find **OAuth 2** and click the eye icon to **Enable** it.
3. Learners visiting `/learn-engine/login/index.php` will now see the branded **"Log in with Zealosh Core"** button, enabling seamless single sign-on without an extra password prompt!
