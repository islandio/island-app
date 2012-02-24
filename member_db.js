// Functionality for members, .

/** Notes:
 *
 */

// var ObjectID = require('mongodb').
var _ = require('underscore');
_.mixin(require('underscore.string'));
var util = require('util');
var debug = util.debug, inspect = util.inspect;
var Step = require('step');


/*
 * Creates a db instance.
 */
var MemberDb = exports.MemberDb = function (db, options, cb) {
  var self = this;
  self.db = db;
  self.collections = {};

  var collections = {
    members: { index: { added: 1, primaryEmail: 1 } },
  };

  Step(
    function () {
      var group = this.group();
      _.each(collections, function (k, name) {
        db.collection(name, group());
      });
    },
    function (err, cols) {
      if (err) return this(err);
      _.each(cols, function (col) {
        self.collections[col.collectionName] = col;
      });
      if (options.ensureIndexes) {
        var parallel = this.parallel;
        _.each(cols, function (col) {
          col.ensureIndex(collections[col.collectionName].index,
                          parallel());
        });
      } else this();
    },
    function (err) {
      cb(err, self);
    }
  );
}


/*
 * Find a member by its primaryEmail. If it does not exist
 * create one using the given props.
 */
MemberDb.prototype.findOrCreateMemberFromOpenId = function (props, cb) {
  var self = this;
  props.primaryEmail = props.emails[0].value;
  self.collections.members.findOne({ primaryEmail: props.primaryEmail },
                                  function (err, member) {
    if (err) return cb(err);
    if (!member) {
      _.extend(props, {
        meta: {},
        role: 1,
      });
      createDoc.call(self, self.collections.members, props, cb);
    } else cb(null, member);
  });
}


/*
 * Create methods for members, comments, ratings, media.
 */
MemberDb.prototype.createMedia = function (props, cb) {
  if (!_.has(props, ['title', 'body', 'type', 'memberId', 'attached']))
    return cb(new Error('Invalid media.'));
  var tags = props.tags && props.tags !== '' ?
      makeTags(props.tags) : [];
  _.defaults(props, {
    key: makeURLKey(8),
    comments: [],
    meta: {
      tags: tags,
      ratings: [],
      hits: 0,
    },
  });
  createDoc.call(this, this.collections.media, props, cb);
}
MemberDb.prototype.createComment = function (props, cb) {
  if (!_.has(props, ['body', 'memberId', 'parentId']))
    return cb(new Error('Invalid comment.'));
  _.defaults(props, {
    likes: 0,
  });
  createDoc.call(this, this.collections.comments, props, cb);
}


/*
 * Add a rating to existing media.
 */
MemberDb.prototype.addRating = function (props, cb) {
  if (!_.has(props, ['memberId', 'hearts']))
    return cb(new Error('Invalid rating.'));
  _.defaults(props, {

  });
  cb();
}


/*
 * Find a member by its _id.
 */
MemberDb.prototype.findMemberById = function (id, cb) {
  if ('string' === typeof id)
    id = new ObjectID(id);
  this.collections.members.findOne({ _id: id },
                                function (err, member) {
    cb(err, member);
  });
}


/*
 * Get some media.
 */
MemberDb.prototype.findMedia = function (props, cb) {
  // count hearts
  // if (this.meta.ratings) {
  //   var hearts = 0;
  //   for (var i=0; i < this.meta.ratings.length; i++) {
  //     hearts += this.meta.ratings[i].hearts;
  //   }
  //   this.meta.hearts = hearts;
  // }
}


/*
 * Insert a document into a collecting
 * adding `added` key if it doesn't
 * exist in the given props.
 */
function createDoc(collection, props, cb) {
  var self = this;
  function insert() {
    collection.insert(props, { safe: true },
                      function (err, inserted) {
      cb(err, inserted[0]);
    });
  }
  if (!props.added)
    props.added = new Date;
  insert();
}


/**
  * Create a string identifier
  * for use in a URL at a given length.
  */
function makeURLKey(length) {
  var key = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
      'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i)
    key += possible.charAt(Math.floor(
          Math.random() * possible.length));
  return key;
}

/**
 * Make array of searchable terms from str
 */
function makeTags(str) {
  str = str.replace(/[~|!|@|#|$|%|^|&|*|(|)|_|+|`|-|=|[|{|;|'|:|"|\/|\\|?|>|.|<|,|}|]|]+/gi, '');
  str = str.replace(/\s{2,}/g, ' ');
  return str.toLowerCase().trim().split(' ');
}




// function findMedia(next, filter) {
//   Media.find(filter).sort('added', 1).run(function (err, media) {
//     if (!err) {
//       var num = media.length
//         , cnt = 0
//       ;
//       if (num > 0) {
//         media.forEach(function (med) {
//           Member.findById(med.member_id, function (err, member) {
//             med.member = member;
//             cnt++;
//             if (cnt == num) {
//               next(media);
//             }
//           });
//         });
//       } else { 
//         next([]);
//       }
//     } else {
//       next([]);
//     }
//   });
// }
// 
// /**
//  * 
//  * @param
//  */
// function getTrending(limit, next) {
//   Media.find({}, [], { limit: limit }).sort('meta.hearts', -1).run(function (err, media) {
//     if (!err) {
//       var num = media.length
//         , cnt = 0
//       ;
//       if (num > 0)
//         media.forEach(function (med) {
//           Member.findById(med.member_id, function (err, member) {
//             med.member = member;
//             cnt++;
//             if (cnt == num)
//               next(media);
//           });
//         });
//       else
//         next([]);
//     } else
//       next([]);
//   });
// }
// 
// /**
//  * 
//  * @param
//  */
// function getRecentComments(limit, next) {
//   Comment.find({}, [], { limit: limit }).sort('added', -1).run(function (err, coms) {
//     var num = coms.length
//       , cnt = 0
//     ;
//     if (err || num == 0)
//       next([]);
//     else
//       coms.forEach(function (com) {
//         Member.findById(com.member_id, function (err, mem) {
//           if (!err) {
//             com.member = mem;
//             Media.findById(com.parent_id, function (err, med) {
//               if (!err) {
//                 com.parent = med;
//                 cnt++;
//                 if (cnt == num)
//                   next(coms);
//               } else {
//                 next([]);
//                 return;
//               }
//             });
//           } else {
//             next([]);
//             return;
//           }
//         });
//       });
//   });
// }






// /**
//  * 
//  * @param
//  */
// function renderObject(obj, next) {
//   Member.findById(obj.member_id, function (err, mem) {
//     if (!err) {
//       obj.member = mem;
//       next(templates.object({ object: obj }));
//     } else {
//       next(err);
//     }
//   });
// }
// 
// /**
//  * 
//  * @param
//  */
// function renderComment(com, next) {
//   Member.findById(com.member_id, function (err, mem) {
//     if (!err) {
//       com.member = mem;
//       Media.findById(com.parent_id, function (err, med) {
//         if (!err) {
//           var chtml = templates.comment({ comment: com });
//           com.parent = med;
//           var rhtml = templates.comment({ comment: com });
//           next(chtml, rhtml);
//         } else {
//           next([]);
//         }
//       });
//     } else {
//       next(err);
//     }
//   });
// }
// 
// /**
//  * 
//  * @param
//  */
// function getTwitterNames(next) {
//   Member.find({}, function (err, data) {
//     if (!err) {
//       var twitters = []
//         , num = data.length
//         , cnt = 0
//       ;
//       if (num > 0)
//         data.forEach(function (mem) {
//           twitters.push(mem.twitter);
//           cnt++;
//           if (cnt == num)
//             next(twitters);
//         });
//       else 
//         next([]);
//     } else 
//       next([]);
//   });
// }


