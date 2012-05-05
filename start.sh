#!/bin/zsh

exec node app.js --port 3644 --db 'mongo://10.112.1.168:27017/island'
