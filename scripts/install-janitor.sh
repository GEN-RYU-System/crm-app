#!/bin/sh
set -eu
mkdir -p "$HOME/Library/LaunchAgents"
cp launchd/com.crm-app.janitor.plist "$HOME/Library/LaunchAgents/com.crm-app.janitor.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.crm-app.janitor.plist"
