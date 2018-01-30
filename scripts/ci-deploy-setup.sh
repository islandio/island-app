#!/usr/bin/env bash

# EB configs
mkdir ~/.aws
touch ~/.aws/config
printf "[profile eb-cli]\naws_access_key_id = %s\naws_secret_access_key = %s\n" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY" >> ~/.aws/config
mkdir .elasticbeanstalk
touch .elasticbeanstalk/config.yml
printf "global:\n  application_name:" >> .elasticbeanstalk/config.yml
printf " The Island\n  sc:" >> .elasticbeanstalk/config.yml
printf " git\n" >> .elasticbeanstalk/config.yml

# Force commit build
git config user.email "runner@island.io"
git config user.name "Island Runner"
git add -f node_modules --all
git commit -q -a -m "$CI_BUILD_REF_NAME $CI_BUILD_REF $CI_BUILD_ID"
