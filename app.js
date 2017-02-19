var _ = require('underscore');

exports.init = function () {
  exports.app = require('express')();
  exports.use = _.bind(exports.app.use, exports.app);
  // exports.locals = _.bind(exports.app.locals, exports.app);
  exports.all = _.bind(exports.app.all, exports.app);
  exports.get = _.bind(exports.app.get, exports.app);
  exports.set = _.bind(exports.app.set, exports.app);
  exports.post = _.bind(exports.app.post, exports.app);
  exports.put = _.bind(exports.app.put, exports.app);
  exports.delete = _.bind(exports.app.delete, exports.app);
  return exports.app;
};
