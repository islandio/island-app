#!/usr/bin/env bash

if [[ (! -f ./build/build.txt) ]]; then
echo "ERROR: Run 'npm run build' first.\n"
exit 1
fi
PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F= "{ print $2 }" | sed 's/[version:,\",]//g' | tr -d '[[:space:]]')
./node_modules/.bin/s3-cli sync --delete-removed --config s3cmd.conf --acl-public ./build s3://builds-island/$PACKAGE_VERSION
