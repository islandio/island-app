#!/bin/sh

# check backup directory
if [ $# -eq 0 ]
then
  DIR=./backups
else
  DIR=$1
fi
mkdir -p $DIR
cd $DIR
touch backups.log

# save time
now=`date +%Y.%m.%d.%H.%M.%S`

# perform the backup on the remote database server
echo "backing up remote database..."
ssh -i ~/.ec2/islandio.pem ec2-user@50.19.109.37 ./backup-remote.sh

# fetch and stash the backup
echo "fetching backup from remote..."
scp -i ~/.ec2/islandio.pem ec2-user@50.19.109.37:backups/island-db.tar.bz2 island-db.$now.tar.bz2

# unpacking backup 
echo "unpacking remote backup..."
tar xjf island-db.$now.tar.bz2

# clear the local database
echo "dropping local database..."
mongo localhost:27020/islandio-development --quiet --eval "var dropped = db.dropDatabase()" >> backups.log 2>&1

# restore the local database
echo "restoring local database from remote backup..."
mongorestore -d islandio-development -h localhost:27020 island-db >> backups.log 2>&1

# delete the uncompressed directory
echo "cleaning up..."
rm -rf island-db

# done
echo "done."
exit 0