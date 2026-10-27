<?php
// ==============================================================================
// Zealosh Learning Engine — MUC Redis Store Configuration Script
// Registers Redis Cache Store on Database 2 with prefix 'zealosh_moodle_muc_'
// ==============================================================================

define('CLI_SCRIPT', true);
require_once('/var/www/html/config.php');
require_once($CFG->dirroot . '/cache/locallib.php');

$redisHost = getenv('REDIS_HOST');
if (empty($redisHost)) {
    echo "[INFO] REDIS_HOST not configured. MUC remains on standard filesystem cache.\n";
    exit(0);
}

$redisPort = (int)(getenv('REDIS_PORT') ?: 6379);
$redisPass = getenv('REDIS_PASSWORD') ?: '';

try {
    echo "[INFO] Configuring Moodle Universal Cache (MUC) Redis Store on Database 2...\n";
    $writer = cache_config_writer::instance();
    $stores = $writer->get_registered_stores();

    // Check if redis plugin is installed
    $plugins = core_component::get_plugin_list('cachestore');
    if (!isset($plugins['redis'])) {
        echo "[WARN] cachestore_redis plugin not available in Moodle core. MUC remains on filesystem.\n";
        exit(0);
    }

    $storeName = 'zealosh_redis_muc';
    $currentInstances = $writer->get_registered_stores();

    $configuration = [
        'server' => "{$redisHost}:{$redisPort}",
        'prefix' => 'zealosh_moodle_muc_',
        'password' => $redisPass,
        'serializer' => 1, // PHP serializer
        'database' => 2,   // Dedicated DB 2 for MUC application caching
    ];

    if (!array_key_exists($storeName, $currentInstances)) {
        $writer->add_store_instance($storeName, 'redis', $configuration);
        echo "[PASS] Successfully added MUC Redis cache store '$storeName' on Redis DB 2.\n";
    } else {
        $writer->edit_store_instance($storeName, 'redis', $configuration);
        echo "[INFO] Updated existing MUC Redis cache store '$storeName' on Redis DB 2.\n";
    }

} catch (Exception $e) {
    echo "[WARN] Unable to configure MUC Redis store: " . $e->getMessage() . "\n";
    echo "[INFO] MUC will continue operating safely on local persistent storage (/var/moodledata/cache).\n";
}
