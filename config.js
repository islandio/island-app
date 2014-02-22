/*
 * config.js: Connection configuration.
 *
 */

exports.get = function (env) {
  return env === 'production' ?
      {
        MONGO_URI: 'URI',
        REDIS_HOST: 'HOST',
        REDIS_PASS: 'PASS',
        REDIS_PORT: 'PORT'
      }:
      {
        MONGO_URI: 'mongodb://localhost:27017/island',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      };
}
