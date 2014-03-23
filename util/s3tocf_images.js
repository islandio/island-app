#!/usr/bin/env node
/*
 * s3tocf_images.js: Move image media from AWS S3 to Rackspace Cloudfiles.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('from', 'S3 bucket')
      .demand('from')
    .describe('to', 'Cloudfiles container')
      .demand('to')
    .describe('limit', 'Media limit')
      .demand('limit')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var pkgcloud = require('pkgcloud');
var fs = require('fs');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var com = require('../lib/common');
var domain = require('domain');

boots.start({index: argv.index}, function () {

  // S3 client.
  var s3 = pkgcloud.storage.createClient({
    provider: 'amazon',
    key: 'kdL8k9yEoQXCt39z1TU/Z+TOlctcZ2Coxs0BRAjm',
    keyId: 'AKIAJE7B76FRJNGSKWCA'
  });

  // Cloudfiles client
  var rs = {
    provider: 'rackspace',
    username: 'sanderpick',
    apiKey: '6ca3ec8b435d75cd7eae3fb6a90e4cca',
    region: 'IAD'
  };
  var cf = pkgcloud.storage.createClient(rs);

  // Get Cloudfiles container.
  pkgcloud.storage.createClient(rs).getContainer(argv.to, function (err, cont) {
    boots.error(err);

    // Save CDN uris.
    var CDN_URIs = {
      uri: cont.cdnUri,
      ssl_uri: cont.cdnSslUri,
      streaming_uri: cont.cdnStreamingUri,
      ios_uri: cont.cdniOSUri
    };

    // Grab handle from S3 URL.
    function getS3Handle(url) {
      var m = url.match(/islandio\.s3\.amazonaws\.com\/(.+)/);
      return m ? m[1]: null;
    }

    // Build CDN URLs.
    function getCDN_URLs(name) {
      return {
        url: [CDN_URIs.uri, name].join('/'),
        ssl_url: [CDN_URIs.ssl_uri, name].join('/'),
        streaming_url: [CDN_URIs.streaming_uri, name].join('/'),
        ios_url: [CDN_URIs.ios_uri, name].join('/'),
      };
    }

    // Download from S3 and pipe stream to Cloudfiles.
    function doTransfer(file, cb) {
      var name = getS3Handle(file.url);
      if (!name) return cb();
      var d = domain.create();
      d.on('error', function (err) {
        util.log('Transfer ERROR: ' + err.message);
        cb(null, file);
      });
      d.run(function () {

        // Download.
        s3.download({container: argv.from, remote: name}, function (err) {
          if (err) throw err;
          else util.log('Downloaded: ' + name);
        }).pipe(

          // Upload.
          cf.upload({container: argv.to, remote: name}, function (err) {
            if (err) throw err;
            else {
              util.log('Uploaded: ' + name);
              file.s3_url = file.url;
              _.extend(file, getCDN_URLs(name));
              cb(null, file);
            }
          }))
          .on('close', function () {});
      });

    }

    Step(
      function () {

        // Get all image type media.
        db.Medias.list({type: 'image'}, {limit: Number(argv.limit),
            sort: {created: 1}}, this);
      },
      function (err, docs) {
        boots.error(err);

        util.log('Found media: ' + docs.length);
        if (docs.length === 0) return this();
        var _this = _.after(docs.length, this);
        _.each(docs, function (d) {

          Step(
            function () {

              // Transfer the file image.
              doTransfer(d.image, this.parallel());

              // Transfer tje file thumbs.
              _.each(d.thumbs, _.bind(function (t) {
                doTransfer(t, this.parallel());
              }, this));
            },
            function (err) {
              if (err) return this(err);
              db.Medias._update({_id: d._id}, d, function (err) {
                if (err) return _this(err);
                _this();
              });
            }
          );
        });  
      },
      function (err) {
        boots.error(err);
        console.log('bye');
        process.exit(0);
      }
    );    

  });

});
