var should = require('should');
var assert = require('assert');
var request = require('supertest');
var common = require('../../test/common');
var Step = require('step');
var _ = require('underscore');

describe('Mentions', function() {

  before('Setup some island members for testing', function(done) {

    Step(
      function() {
        common.createMember('testerA', this.parallel());
        common.createMember('testerB', this.parallel());
        common.createMember('testerC', this.parallel());
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
          //delay .2s for DB to catchup
          setTimeout(_.bind(function() {
            return this(err);
          }, this), 1000);
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
        notes.items[0].event.data.action.t.should.equal('mention');
        notes.items[0].event.data.target.b
            .should.equal('Hello \u0091@testerB\u0092');
        done(err);
      }
    );
  });

  it('A mentions B in a comment on A\'s stand-alone post', function(done) {
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
        common.createComment('Comment @testerB', 'post', res.body.id, this);
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
        notes.items.length.should.equal(2)
        notes.items[0].event.data.action.t.should.equal('mention');
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
          setTimeout(_.bind(function() {
            return this(err);
          }, this), 200);
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
        common.deleteMember('testerA', this.parallel());
        common.deleteMember('testerB', this.parallel());
        common.deleteMember('testerC', this.parallel());
      },
      done
    );
  });

});
