# BOSS Job Collector Extension

This Chrome/Chromium extension collects visible job cards from an already-open BOSS Zhipin search page and imports them into the local JobSearch Agent API.

## Install

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this `boss-collector-extension` directory.

## Use

1. Start the local backend and make sure `http://127.0.0.1:8011` is reachable.
2. Open BOSS Zhipin and search for a role/city manually.
3. The import widget appears in the page corner.
4. Click import to send the currently visible real job cards to JobSearch Agent.

The extension does not bypass platform security checks. If BOSS asks for verification, complete it manually first.
