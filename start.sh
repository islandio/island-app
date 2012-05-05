#!/bin/zsh

exec node app.js --port 80 --db 'mongo://10.112.1.168:27017/island'
