#!/usr/bin/env bash

PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F= "{ print $2 }" | sed 's/[version:,\",]//g' | tr -d '[[:space:]]')
./node_modules/.bin/s3-cli sync --delete-removed --config s3cmd.conf --acl-public ./build s3://builds-island/$PACKAGE_VERSION
