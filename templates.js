var fs = require('fs');
var path = require('path');
var jade = require('jade');

fs.readdir(path.join(__dirname, 'views'), function (err, files) {
  files.forEach(function (f) {
    if (f.charAt(0) !== '.') {
      var dotAt = f.indexOf('.jade');
      if (dotAt !== -1) {
        var name = f.substr(0, dotAt);
        exports[name] = jade.compile(fs.readFileSync(path.join(__dirname, 'views', f)));
      }
    }
  });
});

