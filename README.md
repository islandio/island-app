![Island Build Status](https://circleci.com/gh/The-Island/island-app.svg?style=shield&circle-token=f46cdeda0c3c2f693e5e085b5f3b980561a2d41b "Island-app Build Status")

# The Island

### Development

##### Getting started

1. Download and install [Node.JS](http://nodejs.org/download/) from the latest stable source or package installer (recommended).
2. Download and install [MongoDB](http://www.mongodb.org/downloads) from the latest stable source. Use ```bin/mongod``` to start a local DB server in the background.
3. Download and install [Redis](http://redis.io/download). Do something like [this](http://reistiago.wordpress.com/2011/07/23/installing-on-redis-mac-os-x/) to start the Redis server via a launch daemon, or just do ```redis-server``` whenever developing.
4. Download and install [ØMQ](http://zeromq.org/docs:source-git).
5. Install application dependencies with ```npm install```. This will install everything specified in ```package.json```.
6. Install the frontend builder globally ```npm install grunt-cli -g```
7. Install ```nodemon``` globally with ```npm install nodemon -g```. Use ```nodemon``` in place of ```node``` to restart your local web server whenever changes are made... very handy.
8. Now you can start your local web server with ```nodemon main.js```.
9. Clone [island-pubsub](https://github.com/The-Island/island-pubsub).
10. Install island-pubsub dependencies with ```npm install```.
11. Start island-pubsub with ```node start.js```.

Island is now running at [```http://localhost:8080/```](http://localhost:8080/).

##### Development Rules

1. The mainline development branch for Island is called ```develop```.
2. Features are developed in feature branches. Try to work against a [Github issue](https://github.com/The-Island/island-app/issues).
3. [JSHint](http://jshint.com/) all files using Island's [.jshintrc](https://github.com/The-Island/island-app/blob/develop/linters/.jshintrc) file.
4. When ready, rebase the feature branch onto ```develop```, open a Github pull request, and request a review from another Island developer.
5. Once reviewed, merge and close the pull request.

##### Deployment TBD
1. Deployment rules
2. Devleopment server
3. Testing rules

##### Shipping

Now that everyting is setup, you can build a new version:

```
$ npm version patch
$ npm run build
```

Then deploy the static build to S3 and push the app to EBS:

```
$ npm run deploy
```

Check that your new version of Island is running at [```https://www.island.io```](https://www.island.io).

Lastly, ```git push --follow-tags``` to push your changes and tag.

That's it!

### Architecture Notes

##### Search

Search is done on a redis instance. Any search string is inserted into a Redis sorted set with the format ```string::id```. Search is then accomplished by doing a lexicographical comparison on the query. For example, searching for ```sp``` will return any search entry that begins with ```sp``` such as ```speed``` and ```spit```.  

We index of posts, ticks, members, crags and ascents across their names and tags. Entries into the redis cluster are automatically stemmed.

The architecture for search doesn't allow for removal of entries very easily (would need to search the sorted set for an entry which is difficult to do in Redis). Because removal is rare, a good solution is to just re-index nightly. This can be accomplished by installing Node where the Redis instance is located and running a cron job like below.

```0 3 * * * NODE_ENV=production bash -c 'time /home/ec2-user/island-app/util/index.js' >> /var/log/index.js 2>&1```


##### Grading

Grades are stored internally as an index into a grade map. Grades are converted to their text representations (V3, 5.12a etc) on the client.

When an ascent is created, it is assigned a grade by the creator. Every tick that is sent adds to an overall grade consensus. The grade that appears the most in the consensus is the official Island grade. In this way, grades are dynamic and reflect the growing consensus of Island users. If two grades have equal consensus, the earlier grade is considered first. Any given Island user may only suggest a grade for an ascent once. The only exception is when the grade is first assigned to the ascent, which has no author designated.
