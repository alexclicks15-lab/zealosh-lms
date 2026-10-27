<?php
// ==============================================================================
// Zealosh Learning Engine — Protected Moodle CLI Installer Wrapper
// Purpose: Protects administrator password from /proc/<pid>/cmdline process exposure
// Bypasses process argument visibility by reading secret from protected runtime file
// and setting in-memory $_SERVER['argv'] before invoking pinned install_database.php
// ==============================================================================

define('CLI_SCRIPT', true);

$disposableFile = '/run/moodle-installer/moodle_admin_pass.tmp';
$readonlySecret = '/run/secrets/moodle_admin_pass';
$adminPass = false;

// 1. Primary path: Read from disposable working copy on writable tmpfs
if (file_exists($disposableFile)) {
    $raw = file_get_contents($disposableFile);
    if ($raw !== false && $raw !== '') {
        $adminPass = $raw;
    }
    // Zero-wipe and unlink ONLY the disposable working copy if writable
    if (is_writable($disposableFile)) {
        @file_put_contents($disposableFile, str_repeat("\0", 1024));
        @unlink($disposableFile);
    }
}
// 2. Direct fallback: Read original Compose secret as strictly read-only (never attempt overwrite/unlink)
elseif (file_exists($readonlySecret)) {
    $raw = file_get_contents($readonlySecret);
    if ($raw !== false && $raw !== '') {
        $adminPass = $raw;
    }
}

if ($adminPass === false || $adminPass === '') {
    $envPass = getenv('MOODLE_ADMIN_PASSWORD');
    if ($envPass !== false && $envPass !== '') {
        $adminPass = $envPass;
    }
}

if ($adminPass === false || $adminPass === '') {
    fwrite(STDERR, "[FATAL ERROR] Administrator password is empty or unreadable in installer wrapper.\n");
    exit(1);
}

$moodleDir = '/var/www/html';
$adminUser = getenv('MOODLE_ADMIN_USER') ?: 'admin';
$adminEmail = getenv('MOODLE_ADMIN_EMAIL') ?: 'admin@zealosh.com';
$fullName = getenv('MOODLE_SITE_FULLNAME') ?: 'Zealosh Learning Engine';
$shortName = getenv('MOODLE_SITE_SHORTNAME') ?: 'Zealosh LMS';
$lang = getenv('MOODLE_LANG') ?: 'en';

// Set up in-memory arguments vector for Moodle's cli_get_params()
$_SERVER['argv'] = [
    $moodleDir . '/admin/cli/install_database.php',
    '--lang=' . $lang,
    '--adminuser=' . $adminUser,
    '--adminpass=' . $adminPass,
    '--adminemail=' . $adminEmail,
    '--fullname=' . $fullName,
    '--shortname=' . $shortName,
    '--agree-license',
];

$argv = $_SERVER['argv'];
$_SERVER['argc'] = count($argv);
$argc = $_SERVER['argc'];

chdir($moodleDir);

// Execute authoritative pinned Moodle 5.3 CLI installer
require($moodleDir . '/admin/cli/install_database.php');
