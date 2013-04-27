/*
 * media.js: Handling for the media resource.
 *
 */

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var Medias = require('../db.js').Medias;

/* e.g.,
  {
  "_id" : ObjectId("4fa5faa88978bf6865000007"),
  "key": <String>,
  "type": <String>,
  "image": <Object>,
  "thumbs": [<Object>],
  "tcnt": <Number>,
  "hcnt": <Number>,
  "member_id": <ObjectId>,
  "post_id": <ObjectId>,
  "created": <ISODate>,
  "updated": <ISODate>
}
*/

// Define routes.
exports.routes = function (app) {

  app.get('/crags/:country/:crag/:type/:ascent', function (req, res) {
    if (req.params.type !== 'boulders' && req.params.type !== 'routes')
      return res.render('404', {title: 'Not Found'});
    var ckey = [req.params.country, req.params.crag].join('/');
    var akey = [req.params.country, req.params.crag,
        req.params.type, req.params.ascent].join('/');
    Step(
      function () {
        climbDb.collections.crag.findOne({key: ckey}, this.parallel());
        climbDb.collections.ascent.findOne({key: akey}, this.parallel());
      },
      function (err, crag, ascent) {
        if (err || !crag || !ascent)
          return res.render('404', {title: 'Not Found'});
        res.render('ascent', {
          title: ascent.name + ' - ' + [ascent.crag, ascent.country].join(', '),
          crag: crag,
          ascent: ascent,
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