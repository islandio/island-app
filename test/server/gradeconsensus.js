// Run before all unit tests that require a database

var should = require('should');
var assert = require('assert');
var request = require('supertest');
var _ = require('underscore');

var dut = require('../../lib/resources/ascent').calculateGradeByConsensus;

describe('GradeConsensus', function() {

  var consensus = []

  it('0 grades', function() {
    _.isNull(dut(consensus)).should.equal(true);
  });

  it('project grade', function() {
    consensus.push({ grade: -1 });
    dut(consensus).should.equal(-1);
  });

  it('1 grade', function() {
    consensus.push({ grade: 1 });
    dut(consensus).should.equal(1);
  });

  it('2 grades', function() {
    consensus.push({ grade: 2 });
    dut(consensus).should.equal(1);
  });

  it('3 grades', function() {
    consensus.push({ grade: 2 });
    dut(consensus).should.equal(2);
  });

  it('4 grades', function() {
    consensus.push({ grade: 1 });
    dut(consensus).should.equal(1);
  });

  it('new Project grades don\'t matter', function() {
    consensus.push({ grade: -1 });
    consensus.push({ grade: -1 });
    consensus.push({ grade: -1 });
    consensus.push({ grade: -1 });
    consensus.push({ grade: -1 });
    dut(consensus).should.equal(1);
  });

  it('grades with tick_id have preference', function() {
    consensus.push({grade: 3, tick_id: 'eyal'});
    dut(consensus).should.equal(3);
    consensus.push({grade: 4, tick_id: 'eyal'});
    dut(consensus).should.equal(3);
    consensus.push({grade: 4, tick_id: 'eyal'});
    dut(consensus).should.equal(4);
    consensus.push({grade: 3, tick_id: 'eyal'});
    dut(consensus).should.equal(3);
  });

});
