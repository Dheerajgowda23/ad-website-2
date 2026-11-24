#!/bin/sh
# Runs once, during Postgres first-boot initialisation.
#
# Passwords for the two runtime roles come from the environment (docker-compose
# passes PORTAL_PUBLIC_DB_PASSWORD / PORTAL_INTERNAL_DB_PASSWORD). Keeping them out
# of grants.sql means an offline install with generated secrets works, and no
# default password is ever shipped inside the image.
set -eu

: "${PORTAL_PUBLIC_DB_PASSWORD:?PORTAL_PUBLIC_DB_PASSWORD must be set for db init}"
: "${PORTAL_INTERNAL_DB_PASSWORD:?PORTAL_INTERNAL_DB_PASSWORD must be set for db init}"

psql -v ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER:-portal_owner}" \
  --dbname "${POSTGRES_DB:-ada_portal}" \
  -v public_pw="${PORTAL_PUBLIC_DB_PASSWORD}" \
  -v internal_pw="${PORTAL_INTERNAL_DB_PASSWORD}" \
  -v db_name="${POSTGRES_DB:-ada_portal}" \
  -f /opt/ada/grants.sql
