#!/usr/bin/env node
/*
 * update.js: Run some update on the db.
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
var profiles = require('island-collections').profiles;

boots.start(function (client) {

  Step(
    function () {
      client.db.Ticks.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {

        client.db.Events.read({action_id: d._id}, function (err, e) {
          if (err) return _this(err);
          if (e) {
            return _this();
          }

          Step(
            // function () {
            //   if (e) {
            //     client.db.Events.remove({_id: e._id}, this);
            //   } else {
            //     this();
            //   }
            // },
            function (err) {
              if (err) return this(err);
              client.db.inflate(d, {author: profiles.member, crag: profiles.crag,
                  ascent: profiles.ascent, session: profiles.session}, this);
            },
            function (err) {
              if (err) return this(err);

              var params = {data: d};
              params.event = {
                actor_id: d.author._id,
                target_id: d.ascent._id,
                action_id: d._id,
                action_type: 'tick',
                data: {
                  action: {
                    i: d.author._id.toString(),
                    a: d.author.displayName,
                    g: d.author.gravatar,
                    v: d.author.avatar,
                    t: 'tick',
                    b: _.prune(d.note, 40),
                    d: d.date.toISOString(),
                    s: ['sessions', d.session.key].join('/'),
                    m: {
                      s: d.sent,
                      g: d.grade,
                      t: d.tries
                    }
                  },
                  target: {
                    n: d.ascent.name,
                    g: d.ascent.grades,
                    t: d.ascent.type,
                    s: ['crags', d.ascent.key].join('/'),
                    p: {
                      s: ['crags', d.crag.key].join('/'),
                      l: d.crag.location,
                      n: d.crag.name,
                      c: d.crag.country
                    }
                  }
                },
                public: d.public,
                retro: true
              };

              client.events.publish('tick', 'tick.new', params, this.parallel());
              client.events.subscribe(d.author, d, {style: 'watch', type: 'tick'},
                  this.parallel());
            },
            _this
          );

        });
      });
    },

    function (err) {
      boots.error(err);
      console.log('bye');
      process.exit(0);
    }
  );

});
