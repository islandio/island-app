var should = require('should');
var assert = require('assert');
var request = require('supertest');
var common = require('../../test/common');
var Step = require('step');
var _ = require('underscore');

var crag_id, ascent_id;
var wait = function(err, time, cb) {
  setTimeout(function() { return cb(err); }, time);
}

describe('Mentions', function() {

  before('Setup some island members for testing', function(done) {
    this.timeout(30000);

    Step(
      function() {
        common.createMember('testerA', this.parallel());
        common.createMember('testerB', this.parallel());
        common.createMember('testerC', this.parallel());
      },
      function (err) {
        if (err) return this(err);
        common.login('testerC', this);
      },
      function(err) {
        var self = this;
        if (err) return this(err);
        common.createCrag('testCrag', _.bind(function(err, res) {
          if (err) return this(err);
          crag_id = res.body._id;
          common.createAscent('testAscent', 'b', 10, crag_id,
              _.bind(function(err, res) {
            ascent_id = res.body.ascent_id;
            return this(err);
          }, this));
        }, this));
      },
      done
    );

  });

  it('A mentions B in A’s stand-alone post', function(done) {
    Step(
      function() {
        common.login('testerA', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Hello @testerB', _.bind(function(err) {
          wait(err, 200, this);
        }, this));
      },
      function(err) {
        if (err) return this(err);
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items.length.should.equal(1)
        notes.items[0].event.data.action.t.should.equal('mention');
        notes.items[0].event.data.target.b
            .should.equal('Hello \u0091@testerB\u0092');
        done(err);
      }
    );
  });

  it('A mentions B in a comment on A\'s stand-alone post', function(done) {
    this.timeout(60000);
    Step(
      function() {
        common.login('testerA', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Post', this);
      },
      function(err, res) {
        if (err) return this(err);
        common.createComment('Comment @testerB', 'post', res.body.id,
            _.bind(function(err) {
          wait(err, 200, this);
        }, this));
      },
      function(err, res) {
        if (err) return this(err);
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items[0].event.data.action.t.should.equal('mention');
        notes.items[0].event.data.target.t.should.equal('post');
        done(err);
      }
    );
  });

  it('A mentions B in a comment on B\'s stand-alone post', function(done) {
    this.timeout(60000);
    var post_id;
    Step(
      function() {
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Post', this);
      },
      function(err, res) {
        if (err) return this(err);
        post_id = res.body.id;
        common.login('testerA', this);
      },
      function(err, res) {
        if (err) return this(err);
        common.createComment('Comment2 @testerB', 'post', post_id,
            _.bind(function(err) {
          wait(err, 200, this);
        }, this));
      },
      function(err, res) {
        if (err) return this(err);
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items[1].event.data.action.t.should.equal('mention');
        notes.items[1].event.data.target.t.should.equal('post');
        done(err);
      }
    );
  });

  it('A mentions B in a comment on C\'s stand-alone post', function(done) {
    this.timeout(60000);
    var post_id;
    Step(
      function() {
        common.login('testerC', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Post', this);
      },
      function(err, res) {
        if (err) return this(err);
        post_id = res.body.id;
        common.login('testerA', this);
      },
      function(err, res) {
        if (err) return this(err);
        common.createComment('Comment3 @testerB', 'post', post_id,
            _.bind(function(err) {
          wait(err, 200, this);
        }, this));
      },
      function(err, res) {
        if (err) return this(err);
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items[0].event.data.action.t.should.equal('mention');
        notes.items[0].event.data.target.t.should.equal('post');
        done(err);
      }
    );
  });

  it('A mentions B on crag post', function(done) {
    this.timeout(60000);
    Step(
      function() {
        common.login('testerA', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Crag post @testerB', 'crag', crag_id,
            _.bind(function(err) {
          wait(err, 200, this);
        }, this));
      },
      function(err, res) {
        if (err) return this(err);
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items[0].event.data.target.t.should.equal('crag')
        notes.items[0].event.data.target.n
            .should.equal('testCrag, United States');
        done(err);
      }
    );
  });

  it('A mentions B on ascent post', function(done) {
    this.timeout(60000);
    Step(
      function() {
        common.login('testerA', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Ascent post @testerB', 'ascent', ascent_id,
            _.bind(function(err) {
          wait(err, 200, this);
        }, this));
      },
      function(err, res) {
        if (err) return this(err);
        common.login('testerB', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items[0].event.data.target.t.should.equal('ascent')
        notes.items[0].event.data.target.n
            .should.equal('testAscent, testCrag, United States');
        done(err);
      }
    );
  });

  it('@testerA does not receive notification on self-mention',
      function(done) {
    Step(
      function() {
        common.login('testerA', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Hello @testerA', _.bind(function(err) {
          //delay .2s for DB to catchup
          wait(err, 200, this);
        }, this));
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items.length.should.equal(0);
        done(err);
      }
    );
  });

  after('Delete created members', function(done) {
    this.timeout(60000);
    Step(
      function() {
        common.login('testerC', this);
      },
      function() {
        common.deleteCrag('testCrag', this);
      },
      function() {
        common.deleteMember('testerA', this.parallel());
        common.deleteMember('testerB', this.parallel());
        common.deleteMember('testerC', this.parallel());
      },
      done
    );
  });

});
