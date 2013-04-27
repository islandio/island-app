/*
* crag.js: Handling for the crag resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Crags = require('../db.js').Crags;

/* e.g.,
  {
    "_id": <ObjectId>,
    "key": <String>,
    "name": <String>,
    "city": <String>,
    "country": <String>,
    "bcnt": <Number>,
    "rcnt": <Number>,
    "bgrdu": <String>,
    "bgrdl": <String>,
    "rgrdu": <String>,
    "rgrdl": <String>,
    "lat": <Number>,
    "lon": <Number>,
    "country_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>
  }
*/

// Define routes.
exports.routes = function (app) {

  app.get('/crags/:country/:crag', function (req, res) {
    var key = [req.params.country, req.params.crag].join('/');
    var crag;
    Step(
      function () {
        climbDb.collections.crag.findOne({key: key}, this);
      },
      function (err, c) {
        if (err || !c)
          return res.render('404', {title: 'Not Found'});
        crag = c;
        climbDb.collections.ascent.find({
          crag_id: crag._id,
          type: 'b'
        }).sort({name: 1}).toArray(this.parallel());
        climbDb.collections.ascent.find({
          crag_id: crag._id,
          type: 'r'
        }).sort({name: 1}).toArray(this.parallel());
      },
      function (err, boulders, routes) {
        if (err)
          return res.render(500, {error: err});
        var ascents = {
          boulders: {list: boulders},
          routes: {list: routes}
        };
        _.each(ascents, function (v, type) {
          var bucks = [];
          _.each(grades, function (g) { bucks.push([g]); });
          _.each(v.list, function (a) {
            _.each(a.grades, function (g) {
              bucks[grades.indexOf(g)].push(a);
            });
          });
          ascents[type].bucks = bucks;
        });
        res.render('crag', {
          title: [crag.name, crag.country].join(', '),
          crag: crag,
          ascents: ascents,
          member: req.user,
          twitters: twitterHandles,
          util: templateUtil,
          _: _
        });
      }
    );
  });

}

// Scheduled tasks.
exports.jobs = function (cb) {}