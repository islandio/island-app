#!/bin/sh

cd ~/node-service/current/node_modules/now/node_modules/node-proxy/
make
node app.js --port 80 --db 'mongo://islander:V[AMF?UV{b@10.112.1.168:27017/island'
