#!/usr/bin/env bash
# Issue a referral code. Usage: ./scripts/issue-referral.sh UG "Student Name" student@college.edu.in
set -euo pipefail
cd "$(dirname "$0")/.."
LEVEL="${1:-UG}"; NAME="${2:-Student Candidate}"; EMAIL="${3:-student@college.edu.in}"
docker compose -f docker-compose.intranet.yml --profile tools run --rm -T tools \
  npm run issue-code -w @ada/api -- "$LEVEL" "$NAME" "$EMAIL"
