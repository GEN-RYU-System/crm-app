#!/bin/sh
set -eu
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.crm-app.janitor.plist" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.crm-app.janitor.plist"
