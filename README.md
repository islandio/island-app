# Islandio

## Dependencies
Install the following system dependencies before running the Islandio application.

1) [Mongodb] version >= 2.4.6

2) [Nodejs] version >= 0.10.19

3) [NPM] version >= 1.3.11

4) [GruntJS] version >= 0.4.1

4) [GruntCLI] version >= 0.1.9


#### Requirements
Once system dependencies are installed, go ahead and install the package dependencies. This can either be done by installing locally (into node_modules directory of the Islandio application) or globally with the `-g` flag. We'll install them locally as follows. From the root of the application run the following to install the application dependencies:

	$ sudo npm install grunt --save-dev
	$ npm install -g grunt-cli
	$ npm install

#### Running
Be sure to boot up a valid Mongodb server running on default port of 27017. Start the application:

	$ node main.js

## Development

## Shipping/Deployment

## Tests


[GruntJS]: https://github.com/gruntjs/grunt
[GruntCLI]: https://github.com/gruntjs/grunt-cli
[GruntJS Help]: http://gruntjs.com/getting-started
[Mongodb]: http://docs.mongodb.org/manual/installation/
[Nodejs]: http://nodejs.org/download/
[NPM]: https://npmjs.org/