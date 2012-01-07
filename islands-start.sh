#!/bin/sh

sudo rm /mnt/r3/mongod.lock
sudo rm /mnt/r4/mongod.lock
sudo rm /mnt/r5/mongod.lock

sudo mongod --replSet islands --port 27020 --dbpath /mnt/r3 --fork --logpath ~/log/mongodr3.log --logappend
sudo mongod --replSet islands --port 27021 --dbpath /mnt/r4 --fork --logpath ~/log/mongodr4.log --logappend
sudo mongod --replSet islands --port 27022 --dbpath /mnt/r5 --fork --logpath ~/log/mongodr5.log --logappend