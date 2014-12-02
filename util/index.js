#!/usr/bin/env node
/*
 * index.js: Index all members, posts, crags, and ascents for search.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');

var datasetsIndexed = 0;
var channelsIndexed = 0;
var viewsIndexed = 0;
var usersIndexed = 0;

boots.start(function (client) {

  Step(
    function () {

      // Get all datasets.
      client.db.Datasets.list({}, this.parallel());
      client.cache.del('datasets-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        datasetsIndexed += client.cache.index('datasets', d, ['title', 'source', 'tags'],
            _this);
        datasetsIndexed += client.cache.index('datasets', d, ['title', 'source'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);

      // Get all views.
      client.db.Views.list({}, this.parallel());
      client.cache.del('views-search', this.parallel());
    },
    function (err, docs, res) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d, idx) {
        // Add new.
        viewsIndexed += client.cache.index('views', d, ['name', 'tags'], _this);
        viewsIndexed += client.cache.index('views', d, ['name'], {strategy: 'noTokens'},
            _this);
      });
    },
    function (err) {
      boots.error(err);

      // Get all users.
      client.db.Users.list({}, this.parallel());
      client.cache.del('users-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d, idx) {
        // Add new.
        usersIndexed += client.cache.index('users', d, ['displayName', 'username'],
            _this);
      });
    },
    function (err) {
      boots.error(err);

      // Get all channels.
      client.db.Channels.list({}, this.parallel());
      client.cache.del('channels-search', this.parallel());
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length * 2, this);
      _.each(docs, function (d) {
        // Add new.
        channelsIndexed += client.cache.index('channels', d, ['humanName'], _this);
        channelsIndexed += client.cache.index('channels', d, ['humanName'],
            {strategy: 'noTokens'}, _this);
      });
    },
    function (err) {
      boots.error(err);
      util.log('Redis: Indexed users, datasets, views, and channels');
      util.log('Dataset entries: ' + datasetsIndexed);
      util.log('Channel entries: ' + channelsIndexed);
      util.log('View entries: ' + viewsIndexed);
      util.log('User entries: ' + usersIndexed);
      process.exit(0);
    }
  );

});




// #!/usr/bin/env node
// /*
//  * index.js: Index all members, crags, and posts for search.
//  *
//  */

// // Arguments
// var optimist = require('optimist');
// var argv = optimist
//     .describe('help', 'Get help')
//     .argv;

// if (argv._.length || argv.help) {
//   optimist.showHelp();
//   process.exit(1);
// }

// // Module Dependencies
// var util = require('util');
// var Step = require('step');
// var _ = require('underscore');
// _.mixin(require('underscore.string'));
// var boots = require('../boots');
// var db = require('../lib/db');

// var membersIndexed = 0;
// var postsIndexed = 0;
// var cragsIndexed = 0;
// var ascentsIndexed = 0;

// boots.start({redis: true, muri: argv.muri}, function (client) {

//   var cache = client.cache;

//   Step(
//     function () {
//       console.log('Indexing members');

//       // Get all members.
//       db.Members.list({}, this.parallel());
//       cache.del('members-search', this.parallel());
//     },
//     function (err, docs, res) {
//       boots.error(err);

//       if (docs.length === 0) return this();

//       var _this = _.after(docs.length * 2, this);
//       _.each(docs, function (d, idx) {
//         // Add new.
//         membersIndexed += cache.index('members', d, ['displayName', 'userName'],
//             _this);
//         membersIndexed += cache.index('members', d, ['displayName'],
//             _this, {strategy: 'noTokens'});
//       });
//     },
//     function (err) {
//       boots.error(err);
//       console.log('Indexing crags');

//       // Get all crags.
//       db.Crags.list({}, this.parallel());
//       cache.del('crags-search', this.parallel());
//     },
//     function (err, docs, res) {
//       boots.error(err);

//       if (docs.length === 0) return this();
//       var _this = _.after(docs.length * 2, this);
//       _.each(docs, function (d, idx) {
//         // Add new.
//         cragsIndexed += cache.index('crags', d, ['name'], _this);
//         cragsIndexed += cache.index('crags', d, ['name'], {strategy: 'noTokens'},
//             _this);
//       });
//     },
//     function (err) {
//       boots.error(err);
//       console.log('Indexing posts');

//       // Get all posts.
//       db.Posts.list({}, this.parallel());
//       cache.del('posts-search', this.parallel());
//     },
//     function (err, docs) {
//       boots.error(err);

//       if (docs.length === 0) return this();
//       var _this = _.after(docs.length * 2, this);
//       _.each(docs, function (d) {
//         // Add new.
//         postsIndexed += cache.index('posts', d, ['title'], _this);
//         postsIndexed += cache.index('posts', d, ['title'],
//             {strategy: 'noTokens'}, _this);
//       });
//     },
//     function (err) {
//       boots.error(err);
//       console.log('Indexing ascents');

//       // Get all ascents.
//       db.Ascents.list({}, this.parallel());
//       cache.del('ascents-search', this.parallel());
//     },
//     function (err, docs) {
//       boots.error(err);

//       var next = this;

//       if (docs.length === 0) return this();
//       var iter = 0;

//       var run100 = function () {
//         for (var i = iter;i < (iter + 100) && i < docs.length; i++) {
//           ascentsIndexed += cache.index('ascents', docs[i], ['name'], function(err) { step(err, i) });
//         }
//       };

//       var step = function(err, i) {
//         if (err) { boots.error(err); process.exit(0) }
//         else if (i === docs.length) { next(); }
//         else if (i === iter + 100) { 
//           if (i % 30000 === 0) console.log(iter/docs.length * 100 + '%');
//           iter = i;
//           run100();
//         }
//         else {}
//       };

//       run100();

//     },

//     function (err) {
//       boots.error(err);
//       util.log('Redis: Indexed members, ascents, crags, and posts');
//       util.log('Members entries: ' + membersIndexed);
//       util.log('Posts entries: ' + postsIndexed);
//       util.log('Crags entries: ' + cragsIndexed);
//       util.log('Ascents entries: ' + ascentsIndexed);
//       process.exit(0);
//     }
//   );

// });
