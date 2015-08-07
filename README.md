# The Island

### Development

##### Getting started

1. Download and install [Node.JS](http://nodejs.org/download/) from the latest stable source or package installer (recommended).
2. Download and install [MongoDB](http://www.mongodb.org/downloads) from the latest stable source. Use ```bin/mongod``` to start a local DB server in the background.
3. Download and install [Redis](http://redis.io/download). Do something like [this](http://reistiago.wordpress.com/2011/07/23/installing-on-redis-mac-os-x/) to start the Redis server via a launch daemon, or just do ```redis-server``` whenever developing.
4. Download and install [ØMQ](http://zeromq.org/docs:source-git).
5. Install application dependencies with ```npm install```. This will install everything specified in ```package.json```.
6. Install ```nodemon``` globally with ```npm install nodemon -g```. Use ```nodemon``` in place of ```node``` to restart your local web server whenever changes are made... very handy.
7. Now you can start your local web server with ```nodemon main.js```.
8. Clone [island-pubsub](https://github.com/The-Island/island-pubsub).
9. Install island-pubsub dependencies with ```npm install```.
10. Start island-pubsub with ```node start.js```.

Island is now running at [```http://localhost:8080/```](http://localhost:8080/).

##### Development Rules

1. The mainline development branch for Island is called ```develop```.
2. Features are developed in feature branches. Try to work against a [Github issue](https://github.com/The-Island/island-app/issues).
3. [JSHint](http://jshint.com/) all files using Island's [.jshintrc](https://github.com/The-Island/island-app/blob/develop/linters/.jshintrc) file.
4. When ready, rebase the feature branch onto ```develop```, open a Github pull request, and request a review from another Island developer.
5. Once reviewed, merge and close the pull request.

### Deployment

##### Setup

Island runs in production on [AWS Elastic Beanstalk](http://aws.amazon.com/elasticbeanstalk/).

1. Install the [command line interface](http://aws.amazon.com/code/6752709412171743) for EBS. You may also need to install python's boto (```pip install boto```)
2. Install ruby (```apt-get install ruby``` on Linux)
3. Run ```eb init``` to initialize the Amazon file structure and supply the correct Git commands
4. Modify the file structure at the top-level of your local repo.

```
.aws
	aws_credential_file
	islandio.pem
.elasticbeanstalk
	config
	optionsettings.app
```

```.aws/aws_credential_file``` : (_Get these values from Sander or Eyal_)

```
AWSAccessKeyId=<YOUR_IAM_ACCESS_KEY_ID>
AWSSecretKey=<YOUR_IAM_SECRET_KEY>
AWSRegion=us-east-1
```

```.aws/islandio.pem``` : (_Used to ```tail``` logs... get this from Sander or Eyal_)

```.elasticbeanstalk/config``` : (_\<PATH\_TO\_ISLAND\> must be absolute_)

```
[global]
ApplicationName=island-app
AwsCredentialFile=<PATH_TO_ISLAND>/.aws/aws_credential_file
DevToolsEndpoint=git.elasticbeanstalk.us-east-1.amazonaws.com
EnvironmentName=island-app-env
InstanceProfileName=aws-elasticbeanstalk-ec2-role
OptionSettingFile=<PATH_TO_ISLAND>/.elasticbeanstalk/optionsettings.app
RdsEnabled=No
Region=us-east-1
ServiceEndpoint=https://elasticbeanstalk.us-east-1.amazonaws.com
SolutionStack=64bit Amazon Linux 2014.03 v1.0.4 running Node.js
```

```.elasticbeanstalk/optionsettings.app``` :

```
[aws:autoscaling:asg]
MaxSize=3
MinSize=3

[aws:autoscaling:launchconfiguration]
InstanceType=t2.medium
EC2KeyName=islandio
IamInstanceProfile=aws-elasticbeanstalk-ec2-role

[aws:elasticbeanstalk:application:environment]
AWS_ACCESS_KEY_ID=<YOUR_IAM_ACCESS_KEY_ID>
AWS_SECRET_KEY=<YOUR_IAM_SECRET_KEY>
AWS_REGION=us-east-1
NODE_ENV=production
MONGO_URI=<MONGO_URI>
REDIS_HOST_CACHE=<REDIS_HOST_CACHE>
REDIS_HOST_SESSION=<REDIS_HOST_SESSION>
REDIS_PORT=6379
GMAIL_USER=<GMAIL_USER>
GMAIL_PASSWORD=<GMAIL_PASSWORD>
GMAIL_FROM=<GMAIL_FROM>
GMAIL_HOST=smtp.gmail.com
GMAIL_SSL=true
GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
FACEBOOK_NAME=TheIsland
FACEBOOK_CLIENT_ID=<FACEBOOK_CLIENT_ID>
FACEBOOK_CLIENT_SECRET=<FACEBOOK_CLIENT_SECRET>
TWITTER_CONSUMER_KEY=<TWITTER_CONSUMER_KEY>
TWITTER_CONSUMER_SECRET=<TWITTER_CONSUMER_SECRET>
CARTODB_USER=island
CARTODB_TABLE=crags
CARTODB_KEY=<CARTODB_KEY>
PUB_SOCKET_PORT=<PUB_SOCKET_PORT>
SUB_SOCKET_PORT=<SUB_SOCKET_PORT>

[aws:elasticbeanstalk:container:nodejs]
GzipCompression=false
NodeCommand=node start.js
NodeVersion=0.10.26
ProxyServer=none

[aws:elasticbeanstalk:hostmanager]
LogPublicationControl=true

[aws:elasticbeanstalk:monitoring]
Automatically Terminate Unhealthy Instances=true

[aws:elb:loadbalancer]
LoadBalancerHTTPPort=80
LoadBalancerPortProtocol=TCP
LoadBalancerHTTPSPort=443
LoadBalancerSSLPortProtocol=SSL
SSLCertificateId=www_island_io
```

Lastly, install the frontend builder globally.

```
$ npm install grunt-cli -g
```

##### Deployment TBD
1. Deployment rules
2. Devleopment server
3. Testing rules

##### Shipping

Now that everyting is setup, you can concat and minify JS files and send the frontend to Amazon S3.

```
$ ./ship.js .
```

Then deploy to EBS with ```eb push``` or just do it via ```ship.js```.

```
$ ./ship.js --push .
```

Check that your new version of Island is running at [```https://www.island.io```](https://www.island.io).

Lastly, ```git push``` the version bump auto-commit to avoid conflicts in ```package.json``` and/or overwriting old frontend directory on Amazon S3.

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
