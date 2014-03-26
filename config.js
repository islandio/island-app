/*
 * config.js: Connection configuration.
 *
 */

exports.get = function (env) {
  return env === 'production' ?
      {
        MONGO_URI: 'mongodb://islander:isL4nDm0n6o@zoe.mongohq.com:10016/island',
        REDIS_HOST: 'beardfish.redistogo.com',
        REDIS_PASS: '8e79e951bd58df62a99fef22e32f6ede',
        REDIS_PORT: 9806
      }:
      {
        MONGO_URI: 'mongodb://localhost:27017/island_pro',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      };
}
