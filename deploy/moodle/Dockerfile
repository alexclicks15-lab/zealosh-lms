# ==============================================================================
# Zealosh Learning Engine — Production Moodle 5.3 LTS Dockerfile
# Base: Official PHP 8.3 Apache + PostgreSQL 17 Client + Redis Extension
# Eliminates third-party commercial image dependencies (Bitnami Secure Images)
# Pinned to reproducible Moodle release tag
# ==============================================================================

FROM php:8.3-apache

# 1. Install system dependencies & PostgreSQL 17 official client repo
RUN apt-get update && apt-get install -y --no-install-recommends \
    gnupg2 \
    curl \
    ca-certificates \
    lsb-release \
    git \
    unzip \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libicu-dev \
    libzip-dev \
    libxml2-dev \
    libssl-dev \
    ghostscript \
    locales \
    && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    postgresql-client-17 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Configure and install required PHP 8.3 extensions for Moodle 5.3 LTS
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    gd \
    intl \
    zip \
    soap \
    opcache \
    pgsql \
    pdo_pgsql \
    exif \
    bcmath \
    sodium

# 3. Install Redis extension for distributed session & application caching
RUN pecl install redis && docker-php-ext-enable redis

# 4. Configure Apache & PHP (Serving Moodle 5.3 strictly from /var/www/html/public)
RUN a2enmod rewrite headers ssl
COPY deploy/moodle/php-moodle.ini $PHP_INI_DIR/conf.d/moodle.ini
COPY deploy/moodle/apache-moodle.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/moodle/apache-moodle-staging.conf /etc/apache2/sites-available/apache-moodle-staging.conf
COPY deploy/moodle/apache-moodle-production.conf /etc/apache2/sites-available/apache-moodle-production.conf

# Configure Apache MPM prefork to cap worker count at 30 (prevents Supabase connection pool exhaustion)
RUN printf "<IfModule mpm_prefork_module>\n\
    StartServers             4\n\
    MinSpareServers          2\n\
    MaxSpareServers          10\n\
    MaxRequestWorkers        30\n\
    MaxConnectionsPerChild   1000\n\
</IfModule>\n" > /etc/apache2/mods-available/mpm_prefork.conf

# 5. Fetch pinned official Moodle 5.3 LTS maintenance release (Reproducible Build)
# Default pinned release tag: v5.3.0 (or verified immutable commit from MOODLE_503_STABLE)
# NOTE: Do NOT use moving branches (e.g. MOODLE_503_STABLE) directly in production builds
# to prevent unreviewed weekly drift and non-deterministic image generation.
ARG MOODLE_TAG=v5.3.0
RUN git clone --branch ${MOODLE_TAG} --depth 1 https://github.com/moodle/moodle.git /var/www/html \
    && rm -rf /var/www/html/.git

# 6. Create moodledata directory with secure restrictive permissions (0770 www-data:www-data)
RUN mkdir -p /var/moodledata \
    && chown -R www-data:www-data /var/www/html /var/moodledata \
    && chmod -R 755 /var/www/html \
    && chmod -R 0770 /var/moodledata

# 7. Copy entrypoint, cron runner, health checks, installer wrapper, upgrade runner, and cache configuration scripts
COPY deploy/moodle/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY deploy/moodle/cron-runner.sh /usr/local/bin/cron-runner.sh
COPY deploy/moodle/cron-healthcheck.sh /usr/local/bin/cron-healthcheck.sh
COPY deploy/moodle/moodle-healthcheck.sh /usr/local/bin/moodle-healthcheck.sh
COPY deploy/moodle/moodle-installer-wrapper.php /usr/local/bin/moodle-installer-wrapper.php
COPY deploy/moodle/moodle-upgrade-runner.sh /usr/local/bin/moodle-upgrade-runner.sh
COPY deploy/moodle/configure-redis-muc.php /usr/local/bin/configure-redis-muc.php
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/cron-runner.sh /usr/local/bin/cron-healthcheck.sh /usr/local/bin/moodle-healthcheck.sh /usr/local/bin/moodle-installer-wrapper.php /usr/local/bin/moodle-upgrade-runner.sh /usr/local/bin/configure-redis-muc.php

WORKDIR /var/www/html
EXPOSE 80

# Use SIGWINCH for graceful Apache worker termination on container shutdown
STOPSIGNAL SIGWINCH

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
