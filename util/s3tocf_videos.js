#!/usr/bin/env node
/*
 * s3tocf_videos.js: Move video media from AWS S3 to Rackspace Cloudfiles.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('from', 'S3 bucket')
      .demand('from')
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
var transloadit = require('node-transloadit');
var request = require('request');

boots.start({index: argv.index}, function () {

  // Transloadit Client.
  var client = new transloadit('8a36aa56062f49c79976fa24a74db6cc',
      '8998884797d8205ae48b20164683ece041545d6a');

  // Grab handle from S3 URL.
  function getS3Handle(url) {
    var m = url.match(/islandio\.s3\.amazonaws\.com\/(.+)/);
    return m ? m[1]: null;
  }

  Step(
    function () {

      // Get all image type media.
      db.Medias.list({type: 'video', old: {$ne: true}, quality: {$exists: false}},
          {limit: Number(argv.limit), sort: {created: 1}}, this);
    },
    function (err, docs) {
      boots.error(err);

      util.log('Found media: ' + docs.length);
      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        Step(
          function () {

            // Get media parent.
            db.Posts.read({_id: d.parent_id}, this);
          },
          function (err, post) {

            client.send({
              steps: {
                ':original': {
                  robot: '/http/import',
                  url: d.video.url
                }
              },
              template_id: '12d42bc0b2e011e39b5111577fa9dee1'
            }, function (data) {

              // Poll till complete.
              (function check() {
                _.delay(function () {
                  request.get(data.assembly_url, function (err, res, body) {
                    boots.error(err);
                    body = JSON.parse(body);
                    util.log('Status (' + d._id.toString() + '): ' + body.ok);
                    if (body.ok === 'ASSEMBLY_EXECUTING') check();
                    else if (body.ok === 'ASSEMBLY_COMPLETED') {

                      var objs = [];
                      var files = body.results;
                      _.each(files, function (v, k) {
                        if (k !== 'video_encode_iphone'
                            && k !== 'video_encode_ipad'
                            && k !== 'video_encode_hd') return;
                        _.each(v, function (file) {
                          var obj = {
                            type: file.type,
                            parent_id: post._id,
                            author_id: post.author_id
                          };
                          obj[file.type] = file;
                          obj.quality = _.strRightBack(k, '_');
                          _.extend(obj, {
                            poster: _.find(files['video_poster_' + obj.quality], function (img) {
                              return img.original_id === file.original_id;
                            }),
                            thumbs: _.filter(files.video_thumbs, function (img) {
                              return img.original_id === file.original_id;
                            })
                          });
                          objs.push(obj);
                        });
                      });

                      Step(
                        function () {
                          var group = this.group();

                          // Create media docs from objects.
                          _.each(objs, function (props) {
                            db.Medias.create(props, group());
                          });
                        },
                        function (err, medias) {
                          boots.error(err);

                          // Update old media.
                          db.Medias._update({_id: d._id},
                              {$set: {old: true, old_parent_id: d.parent_id},
                              $unset: {parent_id:1}}, _this);
                        }
                      );
                    }
                  });
                }, 1000);
              })();
            }, function (err) { boots.error(err); });

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
