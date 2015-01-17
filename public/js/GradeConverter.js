define([ ], function () {

var GradeConverter = function(type) {

  if (type === 'routes') {

    this.gradeMap = [
      { yds: '5.3'   , brit: '3'  , french: '3'   , aus: '8'}  ,
      { yds: '5.6'   , brit: '4b' , french: '4'   , aus: '13'} ,
      { yds: '5.7'   , brit: '4c' , french: '5a'  , aus: '14'} ,
      { yds: '5.8'   , brit: '4c' , french: '5b'  , aus: '15'} ,
      { yds: '5.9'   , brit: '5a' , french: '5c'  , aus: '17'} ,
      { yds: '5.10a' , brit: '5a' , french: '6a'  , aus: '18'} ,
      { yds: '5.10b' , brit: '5b' , french: '6a+' , aus: '19'} ,
      { yds: '5.10c' , brit: '5b' , french: '6b'  , aus: '20'} ,
      { yds: '5.10d' , brit: '5c' , french: '6b+' , aus: '20'} ,
      { yds: '5.11a' , brit: '5c' , french: '6b+' , aus: '21'} ,
      { yds: '5.11b' , brit: '5c' , french: '6c'  , aus: '22'} ,
      { yds: '5.11c' , brit: '6a' , french: '6c+' , aus: '23'} ,
      { yds: '5.11d' , brit: '6a' , french: '7a'  , aus: '24'} ,
      { yds: '5.12a' , brit: '6a' , french: '7a+' , aus: '25'} ,
      { yds: '5.12b' , brit: '6a' , french: '7b'  , aus: '26'} ,
      { yds: '5.12c' , brit: '6b' , french: '7b+' , aus: '27'} ,
      { yds: '5.12d' , brit: '6b' , french: '7c'  , aus: '28'} ,
      { yds: '5.13a' , brit: '6b' , french: '7c+' , aus: '29'} ,
      { yds: '5.13b' , brit: '6c' , french: '8a'  , aus: '29'} ,
      { yds: '5.13c' , brit: '6c' , french: '8a+' , aus: '30'} ,
      { yds: '5.13d' , brit: '6c' , french: '8b'  , aus: '31'} ,
      { yds: '5.14a' , brit: '7a' , french: '8b+' , aus: '32'} ,
      { yds: '5.14b' , brit: '7a' , french: '8c'  , aus: '33'} ,
      { yds: '5.14c' , brit: '7b' , french: '8c+' , aus: '34'} ,
      { yds: '5.14d' , brit: '7b' , french: '9a'  , aus: '35'} ,
      { yds: '5.15a' , brit: '7b' , french: '9a+' , aus: '36'} ,
      { yds: '5.15b' , brit: '7b' , french: '9b'  , aus: '37'} ,
      { yds: '5.15c' , brit: '7b' , french: '9b+' , aus: '38'} ,
      { yds: '5.15d' , brit: '7b' , french: '9c'  , aus: '39'} ,
      { yds: '5.16a' , brit: '7b' , french: '9c+' , aus: '40'}
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

GradeConverter.prototype.grade = function(grades) {
  // Make into array and then lower case;
  grades = (grades instanceof Array ? grades : [grades]) .map(function (g) {
    return g.toLowerCase(); 
  });

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
