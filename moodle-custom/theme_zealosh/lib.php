<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

/**
 * Returns the main SCSS content for theme_zealosh.
 *
 * @param theme_config $theme The theme config object.
 * @return string The raw SCSS content.
 */
if (!function_exists('theme_zealosh_get_main_scss_content')) {
    function theme_zealosh_get_main_scss_content($theme) {
        global $CFG;

        $scss = '';
        $presetfile = $CFG->dirroot . '/theme/zealosh/scss/preset/zealosh.scss';
        if (file_exists($presetfile)) {
            $scss .= file_get_contents($presetfile);
        }

        // Combine with parent Boost main SCSS
        $parentscss = $CFG->dirroot . '/theme/boost/scss/preset/default.scss';
        if (file_exists($parentscss)) {
            $scss .= "\n" . file_get_contents($parentscss);
        }

        return $scss;
    }
}

/**
 * Serves theme files such as logos and background images.
 */
function theme_zealosh_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    if ($context->contextlevel == CONTEXT_SYSTEM && ($filearea === 'logo' || $filearea === 'favicon')) {
        $theme = theme_config::load('zealosh');
        return $theme->setting_file_serve($filearea, $args, $forcedownload, $options);
    }
    send_file_not_found();
}
