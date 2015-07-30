// Converts grades between various climbing systems
// The 'default' system is french (routes) and font (boulders), however, if
// a country is supplied it will try to convert the grades for that country
//
// Use in both node.js and the browser. If using the browser and requirejs
// make sure to provide underscore as a dependency in a shim


(function() {

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  var root = typeof self === 'object' && self.self === self && self ||
            typeof global === 'object' && global.global === global && global ||
            this;

  var has_require = typeof require !== 'undefined';

  var _ = root._;

  if( typeof _ === 'undefined' ) {
    if( has_require ) {
      _ = require('underscore');
    }
    else throw new Error('GradeConverter requires underscore, see http://underscorejs.org');
  }

  var GradeConverter = function(type) {

    if (type === 'routes') {

      this.gradeMap = [
        { french: '3'   , yds: '5.6'   , brit: '4b' , aus: '13'} ,
        { french: '4'   , yds: '5.7'   , brit: '4c' , aus: '14'} ,
        { french: '5a'  , yds: '5.8'   , brit: '4c' , aus: '15'} ,
        { french: '5b'  , yds: '5.9'   , brit: '5a' , aus: '17'} ,
        { french: '5c'  , yds: '5.10a' , brit: '5a' , aus: '18'} ,
        { french: '6a'  , yds: '5.10b' , brit: '5b' , aus: '19'} ,
        { french: '6a+' , yds: '5.10c' , brit: '5b' , aus: '20'} ,
        { french: '6b'  , yds: '5.10d' , brit: '5c' , aus: '20'} ,
        { french: '6b+' , yds: '5.11a' , brit: '5c' , aus: '21'} ,
        { french: '6c'  , yds: '5.11b' , brit: '5c' , aus: '22'} ,
        { french: '6c+' , yds: '5.11c' , brit: '6a' , aus: '23'} ,
        { french: '7a'  , yds: '5.11d' , brit: '6a' , aus: '24'} ,
        { french: '7a+' , yds: '5.12a' , brit: '6a' , aus: '25'} ,
        { french: '7b'  , yds: '5.12b' , brit: '6a' , aus: '26'} ,
        { french: '7b+' , yds: '5.12c' , brit: '6b' , aus: '27'} ,
        { french: '7c'  , yds: '5.12d' , brit: '6b' , aus: '28'} ,
        { french: '7c+' , yds: '5.13a' , brit: '6b' , aus: '29'} ,
        { french: '8a'  , yds: '5.13b' , brit: '6c' , aus: '29'} ,
        { french: '8a+' , yds: '5.13c' , brit: '6c' , aus: '30'} ,
        { french: '8b'  , yds: '5.13d' , brit: '6c' , aus: '31'} ,
        { french: '8b+' , yds: '5.14a' , brit: '7a' , aus: '32'} ,
        { french: '8c'  , yds: '5.14b' , brit: '7a' , aus: '33'} ,
        { french: '8c+' , yds: '5.14c' , brit: '7b' , aus: '34'} ,
        { french: '9a'  , yds: '5.14d' , brit: '7b' , aus: '35'} ,
        { french: '9a+' , yds: '5.15a' , brit: '7b' , aus: '36'} ,
        { french: '9b'  , yds: '5.15b' , brit: '7b' , aus: '37'} ,
        { french: '9b+' , yds: '5.15c' , brit: '7b' , aus: '38'} ,
        { french: '9c'  , yds: '5.15d' , brit: '7b' , aus: '39'} ,
        { french: '9c+' , yds: '5.16a' , brit: '7b' , aus: '40'}
      ];
    } else {
      this.gradeMap = [
        { font: '3'   , hueco: 'VB' }  ,
        { font: '4'   , hueco: 'V0' }  ,
        { font: '5a'  , hueco: 'V1' }  ,
        { font: '5b'  , hueco: 'V2' }  ,
        { font: '5c'  , hueco: 'V2' }  ,
        { font: '6a'  , hueco: 'V3' }  ,
        { font: '6a+' , hueco: 'V3' }  ,
        { font: '6b'  , hueco: 'V3' }  ,
        { font: '6b+' , hueco: 'V4' }  ,
        { font: '6c'  , hueco: 'V5' }  ,
        { font: '6c+' , hueco: 'V5' }  ,
        { font: '7a'  , hueco: 'V6' }  ,
        { font: '7a+' , hueco: 'V7' }  ,
        { font: '7b'  , hueco: 'V8' }  ,
        { font: '7b+' , hueco: 'V8' }  ,
        { font: '7c'  , hueco: 'V9' }  ,
        { font: '7c+' , hueco: 'V10' } ,
        { font: '8a'  , hueco: 'V11' } ,
        { font: '8a+' , hueco: 'V12' } ,
        { font: '8b'  , hueco: 'V13' } ,
        { font: '8b+' , hueco: 'V14' } ,
        { font: '8c'  , hueco: 'V15' } ,
        { font: '8c+' , hueco: 'V16' } ,
        { font: '9a'  , hueco: 'V16' } ,
        { font: '9a+' , hueco: 'V16' } ,
        { font: '9b'  , hueco: 'V16' } ,
        { font: '9b+' , hueco: 'V16' } ,
        { font: '9c'  , hueco: 'V16' } ,
        { font: '9c+' , hueco: 'V16' }
      ];
    }

    this.type = type;
    this.fromSystem = null;
    this.toSystem = null;

    return this;

  };

  // Hook into module systems
  if( typeof exports !== 'undefined' ) {
    if( typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = GradeConverter;
    }
    exports.GradeConverter = GradeConverter;
  } 
  else {
    root.GradeConverter = GradeConverter;
  }



  /* For sorting - will be slow because of the indexOf commands so use 
   * intelligently */
  GradeConverter.prototype.compare = function(a, b, country, system) {
    system = system || this.getSystem(country);
    var list = _.pluck(this.gradeMap, system);
    return list.indexOf(a) - list.indexOf(b);
  };

  /* Determine the appropriate conversion system for a given country */
  GradeConverter.prototype.getSystem = function(country) {
    if (this.toSystem === 'default') {
      switch (country) {
        case 'United States':
        case 'Canada':
          return (this.type === 'routes') ? 'yds' : 'hueco';
        case 'Australia':
        case 'New Zealand':
          return (this.type === 'routes') ? 'aus' : 'font';
        default:
          return (this.type === 'routes') ? 'french' : 'font';
      }
    } else {
      return this.toSystem;
    }
  };

  /* Direct lookup into the grade maps by index or array of indexes, optionally
   * supplying country or preferred conversion system */
  GradeConverter.prototype.indexes = function(indexes, country, system) {

    if (!indexes) return;

    // Make into array and then lower case;
    var wasArray = indexes instanceof Array;
    indexes = wasArray ? indexes : [indexes];

    var toSystem = system || this.getSystem(country);

    if (!indexes || indexes.length === 0 ||
        !this.fromSystem || !toSystem || _.min(indexes) < 0 ||
        _.max(indexes) > this.gradeMap.length)
      return undefined;

    var results = [];

    var self = this;
    indexes.forEach(function (i) {
      results.push(self.gradeMap[i][toSystem]);
    });

    if (!wasArray) results = results[0];
    return results;
  };

  /* Convert a grade or array of grades directly, optionally supplying
   * country or preferred conversion system */
  GradeConverter.prototype.grades = function(grades, country, system) {
    grades = grades || [];

    var toSystem = system || this.getSystem(country);

    if (this.fromSystem !== null && this.fromSystem === toSystem) {
      return grades;
    }

    // Make into array and then lower case;
    var wasArray = grades instanceof Array;
    grades = (wasArray ? grades : [grades]) .map(function (g) {
      return g.toLowerCase();
    });

    if (grades.length === 0 || grades[0] === 'project') {
      return toSystem === 'indexes' ? [-1]: ['Project'];
    }

    if (!grades || grades.length === 0 || !this.fromSystem || !toSystem) {
      return undefined;
    }

    var results = [];

    var self = this;
    grades.forEach(function (g) {
      self.gradeMap.some(function (e, i) {
        if (e[self.fromSystem].toLowerCase() === g) {
          results.push(toSystem === 'indexes' ? i: e[toSystem]);
          return true;
        } else return false;
      });
    });

    if (!wasArray) results = results[0];
    return results;

  };

  // Get the first index of already converted grades.
  GradeConverter.prototype.indexOf = function(grades, system) {
    var _grades = _.isArray(grades) ? grades : [grades]
    system = system || this.fromSystem;
    var gmap = _.pluck(this.gradeMap, system);
    var idxs = _.map(_grades, function(g) { return gmap.indexOf(g); });
    return _.isArray(grades) ? idxs: idxs[0];
  }

  // Get the index range of a single converted grade
  GradeConverter.prototype.indexRangeOf = function(grade, system) {
    system = system || this.fromSystem;
    var idxs = [];
    var gmap = _.pluck(this.gradeMap, system);
    _.each(this.gradeMap, function(g, i) {
      if (g[system] === grade) {
        idxs.push(i);
      }
    })
    return idxs;
  }

  // Return grades offset by some amount
  GradeConverter.prototype.offset = function(grade, offset, system) {
    system = system || this.fromSystem;
    var gmap = _.unique(_.pluck(this.gradeMap, system))
    for (var idx = 0; idx < gmap.length; idx++) {
      if (gmap[idx] === grade)
        break;
    }
    idx = Math.max(Math.min(idx+offset, gmap.length), 0);
    return gmap[idx];
  };

  // Get a range of grades, ie [V1, V2, V3] inclusive
  GradeConverter.prototype.range = function(gradel, gradeh, system) {
    var range = [];
    var include = false;
    system = system || this.fromSystem;

    for (var idx = 0; idx < this.gradeMap.length; idx++) {
      if (this.gradeMap[idx][system] === gradel) {
        include = true;
      }
      if (include) range.push(this.gradeMap[idx][system])
      if (this.gradeMap[idx][system] === gradeh) {
        include = false;
      }
    }
    return _.unique(range);
  }

  // O(n * m)
  GradeConverter.prototype.min = function(grades, system) {
    system = system || this.fromSystem;
    var gmap = _.pluck(this.gradeMap, system);
    var idx = gmap.length-1;
    _.each(grades, function(g) {
      var i = gmap.indexOf(g);
      if (i < idx) idx = i; 
    })
    return gmap[idx];
  }

  // O(n * m)
  GradeConverter.prototype.max = function(grades, system) {
    system = system || this.fromSystem;
    var gmap = _.pluck(this.gradeMap, system);
    var idx = 0;
    _.each(grades, function(g) {
      var i = gmap.indexOf(g);
      if (i > idx) idx = i; 
    })
    return gmap[idx];
  }

  /* Set origin grading system */
  GradeConverter.prototype.from = function(system) {
    this.fromSystem  = system.toLowerCase();
    return this;
  };

  /* Set target grading system */
  GradeConverter.prototype.to = function(system) {
    this.toSystem  = system.toLowerCase();
    return this;
  };

  return GradeConverter;



}).call(this);
