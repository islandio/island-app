var should = require('should');
var assert = require('assert');
var request = require('supertest');
var common = require('../../test/common');
var Step = require('Step');
var _ = require('underscore');

describe('Mentions', function() {

  before('Setup some island members for testing', function(done) {

    Step(
      function() {
        common.createMember('testerEyal', this.parallel());
        common.createMember('testerSander', this.parallel());
        common.createMember('testerSuperman', this.parallel());
      },
      done
    );

  });

  it('@testerSander receives notification on mention',
      function(done) {
    Step(
      function() {
        common.login('testerEyal', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Hello @testerSander', _.bind(function(err) {
          //delay .2s for DB to catchup
          setTimeout(_.bind(function() {
            return this(err);
          }, this), 1000);
        }, this));
      },
      function(err) {
        if (err) return this(err);
        common.login('testerSander', this);
      },
      function(err) {
        if (err) return this(err);
        common.getNotifications(this);
      },
      function(err, notes) {
        if (err) return done(err);
        notes.items[0].event.data.action.t.should.equal('mention');
        notes.items[0].event.data.target.b
            .should.equal('Hello \u0091@testerSander\u0092');
        done(err);
      }
    );
  });

  it('@testerEyal does not receive notification on self-mention',
      function(done) {
    Step(
      function() {
        common.login('testerEyal', this);
      },
      function(err) {
        if (err) return this(err);
        common.createPost('Hello @testerEyal', _.bind(function(err) {
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
        common.login('testerEyal', this);
      },
      function(err) {
        if (err) return this(err);
        common.deleteMember('testerEyal', this);
      },
      function(err) {
        if (err) return this(err);
        common.login('testerSander', this);
      },
      function(err) {
        if (err) return this(err);
        common.deleteMember('testerSander', this);
      },
      done
    );
  });

});
