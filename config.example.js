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
        REDIS_PORT: 0,
        facebook: {
          name: 'NAME',
          clientID: 'ID',
          clientSecret: 'SECRET'
        },
        twitter: {
          consumerKey: 'KEY',
          consumerSecret: 'SECRET'
        },
        instagram: {
          clientID: 'ID',
          clientSecret: 'SECRET',
          callbackURL: 'URL',
          verifyToken: 'TOKEN',
        },
        transloadit: {
          media: {
            auth: {key: 'KEY'},
            template_id: 'ID'
          },
          profile: {
            auth: {key: 'KEY'},
            template_id: 'ID'
          }
        },
        cloudfront: {
          img: 'URL',
          vid: 'URL',
          aud: 'URL',
          build: 'URL'
        },
        cartodb: {
          user: 'island',
          api_key: 'KEY',
          tables: {
            medias: 'NAME',
            instagrams: 'NAME',
          }
        },
        gmail: {
          user: 'USER',
          password: 'PASSWORD',
          from: 'EMAIL',
          host: 'HOST',
          ssl: 'BOOLEAN'
        }
      }:
      {
        MONGO_URI: 'mongodb://localhost:27017/island',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        facebook: {
          name: 'Island (dev)',
          clientID: 153015724883386,
          clientSecret: '8cba32f72580806cca22306a879052bd'
        },
        twitter: {
          consumerKey: 'ithvzW8h1tEsUBewL3jxQ',
          consumerSecret: 'HiGnwoc8BBgsURlKshWsb1pGH8IQWE2Ve8Mqzz8'
        },
        instagram: {
          clientID: 'b6e0d7d608a14a578cf94763f70f1b49',
          clientSecret: 'a3937ee32072457d92eaa2165bd7dd37',
          callbackURL: '/members/connect/instagram/callback',
          verifyToken: 'doesthisworkyet',
        },
        transloadit: {
          media: {
            auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
            template_id: '29c60cfc5b9f4e8b8c8bf7a9b1191147'
          },
          profile: {
            auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
            template_id: '396d7cb3a2a5437eb258c3e86000f3bf'
          }
        },
        cloudfront: {
          img: 'https://d2a89oeknmk80g.cloudfront.net/',
          vid: 'https://d2c2zu8qn6mgju.cloudfront.net/',
          aud: 'https://d2oapa8usgizyg.cloudfront.net/',
          build: 'URL'
        },
        cartodb: {
          user: 'island',
          api_key: '883965c96f62fd219721f59f2e7c20f08db0123b',
          tables: {
            medias: 'medias_dev',
            instagrams: 'instagrams_dev',
          }
        },
        gmail: {
          user: 'robot@island.io',
          password: 'I514nDr06ot',
          from: 'Island <robot@island.io>',
          host: 'smtp.gmail.com',
          ssl: true
        }
      };
}
