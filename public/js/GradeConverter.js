define([ ], function () {

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
      { font: '5'   , hueco: 'V1' }  ,
      { font: '5+'  , hueco: 'V2' }  ,
      { font: '6a'  , hueco: 'V3' }  ,
      { font: '6a+' , hueco: 'V3' }  ,
      { font: '6b'  , hueco: 'V4' }  ,
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
      { font: '9a'  , hueco: 'V17' } ,
      { font: '9a+' , hueco: 'V18' } ,
      { font: '9b'  , hueco: 'V19' } ,
      { font: '9b+' , hueco: 'V20' } ,
      { font: '9c'  , hueco: 'V21' } ,
      { font: '9c+' , hueco: 'V22' }
    ];
  }

  this.fromSystem = null;
  this.toSystem = null;

  return this;

}

GradeConverter.prototype.compare = function(a, b) {
  var list = _.pluck(this.gradeMap, this.toSystem);
  return list.indexOf(a) - list.indexOf(b);
}

// Direct lookup into the grade map
GradeConverter.prototype.indexes = function(indexes) {

  // Make into array and then lower case;
  indexes = (indexes instanceof Array ? indexes : [indexes]);

  if (!indexes || indexes.length === 0 || !this.fromSystem || !this.toSystem)
    return undefined;

  var results = [];

  var self = this;
  indexes.forEach(function (i) {
    results.push(self.gradeMap[i][self.toSystem]);
  });

  return results;
}

GradeConverter.prototype.grades = function(grades) {

  if (this.fromSystem !== null && this.fromSystem === this.toSystem)
    return grades;

  // Make into array and then lower case;
  grades = (grades instanceof Array ? grades : [grades]) .map(function (g) {
    return g.toLowerCase(); 
  });

  if (!grades || grades.length === 0 || !this.fromSystem || !this.toSystem)
    return undefined;

  var results = [];

  var self = this;
  grades.forEach(function (g) {
    self.gradeMap.some(function (e) {
      if (e[self.fromSystem] === g) {
        results.push(e[self.toSystem]);
        return true;
      } else return false;
    });
  });

  if (results.length < 2) results = results[0];
  return results;

}

GradeConverter.prototype.from = function(system) {
  this.fromSystem  = system.toLowerCase();
  return this;
}

GradeConverter.prototype.to = function(system) {
  this.toSystem  = system.toLowerCase();
  return this;
}

return GradeConverter;
});

