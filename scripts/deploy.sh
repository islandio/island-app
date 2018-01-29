#!/usr/bin/env bash

if [[ (! -f ./build/build.txt) ]]; then
echo "ERROR: Run 'npm run build' first.\n"
exit 1
fi

VERSION=$(awk '/version/{gsub(/("|",)/,"",$2);print $2};' package.json)

./node_modules/.bin/s3-cli sync --delete-removed --config s3cmd.conf --acl-public ./build s3://builds-island/$VERSION

eb deploy the-island-app --profile eb-cli2
