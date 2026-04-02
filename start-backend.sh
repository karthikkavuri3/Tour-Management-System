#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m"

SERVICES=(
  "api-gateway"
  "auth-service"
  "tour-service"
  "booking-service"
  "notification-service"
)

if ! command -v osascript >/dev/null 2>&1; then
  echo -e "${RED}[ERROR]${NC} osascript is required on macOS for Cursor terminal automation."
  exit 1
fi

escape_applescript_string() {
  local input="$1"
  input="${input//\\/\\\\}"
  input="${input//\"/\\\"}"
  printf "%s" "$input"
}

run_cursor_command() {
  local command_name="$1"
  local command_name_escaped
  command_name_escaped="$(escape_applescript_string "$command_name")"

  osascript <<EOF
tell application "Cursor" to activate
delay 0.2
tell application "System Events"
  keystroke "p" using {command down, shift down}
  delay 0.25
  keystroke "${command_name_escaped}"
  delay 0.25
  key code 36
end tell
EOF
}

type_in_cursor_terminal() {
  local shell_command="$1"
  local shell_command_escaped
  shell_command_escaped="$(escape_applescript_string "$shell_command")"

  osascript <<EOF
tell application "Cursor" to activate
delay 0.2
tell application "System Events"
  keystroke "${shell_command_escaped}"
  key code 36
end tell
EOF
}

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE} Starting Backend Services in Separate Cursor Terminals${NC}"
echo -e "${BLUE}==================================================${NC}"
echo -e "${YELLOW}Note:${NC} Cursor must be installed as 'Cursor' and Accessibility access must be granted."
echo

for service in "${SERVICES[@]}"; do
  service_dir="${ROOT_DIR}/${service}"

  if [[ ! -d "${service_dir}" ]]; then
    echo -e "${RED}[ERROR]${NC} Missing directory: ${service_dir}"
    exit 1
  fi

  echo -e "${BLUE}[OPEN]${NC} Creating a new terminal tab for ${service}"
  run_cursor_command "Terminal: Create New Terminal"

  sleep 0.35
  echo -e "${BLUE}[START]${NC} ${service} -> live logs in its own terminal"
  type_in_cursor_terminal "cd \"${service_dir}\" && mvn spring-boot:run"
  sleep 0.45
done

echo
echo -e "${GREEN}[DONE]${NC} Startup commands sent to separate Cursor terminals."
echo -e "${YELLOW}Tip:${NC} Use your existing stop script to kill all backend service ports."
