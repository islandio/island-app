var should = require('should');
var assert = require('assert');
var GradeConverter = require('../../public/js/GradeConverter.js')

var gcr = new GradeConverter('routes');
var gcb = new GradeConverter('boulders');

describe('GradeConverter', function() {

  it('convert a single grade', function() {
    gcr.convert(0).should.equal('3');
    gcb.convert(0).should.equal('3');
  });

  it('convert single grade in American style', function() {
    gcr.convert(0, 'United States').should.equal('5.6');
    gcb.convert(0, 'United States').should.equal('VB');
  });

  it('convert single grade in Australian style', function() {
    gcr.convert(0, 'Australia').should.equal('13');
    gcb.convert(0, 'Australia').should.equal('3');
  });

  it('convert a few grades', function() {
    var arr = [0, 1, 2];
    gcb.convert(arr, 'United States').should.eql(['VB', 'V0', 'V1']);
  });

  it('sort grades', function() {
    var arr = [2, 0, 1];
    var g = gcb.convert(arr, 'United States');
    g.should.eql(['V1', 'VB', 'V0']);
    g.sort(function(a, b) {
      return gcb.compare(a, b, 'United States');
    })
    g.should.eql(['VB', 'V0', 'V1']);
  });


  it('offset grade', function() {
    var g = gcb.convert(3, 'United States');
    g.should.equal('V2');
    gcb.offset(g, 3, 'hueco').should.equal('V5');
  });

  it('grade range', function() {
    gcb.range('V1', 'V7', 'hueco').should.eql(['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7']);
  });

});
