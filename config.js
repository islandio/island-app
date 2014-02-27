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
        REDIS_PORT: 9806,
        facebook: {
          name: 'Island',
          clientID: 203397619757208,
          clientSecret: 'af79cdc8b5ca447366e87b12c3ddaed2'
        },
        twitter: {
          consumerKey: 'ithvzW8h1tEsUBewL3jxQ',
          consumerSecret: 'HiGnwoc8BBgsURlKshWsb1pGH8IQWE2Ve8Mqzz8'
        },
        instagram: {
          clientID: 'a3003554a308427d8131cef13ef2619f',
          clientSecret: '369ae2fbc8924c158316530ca8688647',
          callbackURL: '/members/connect/instagram/callback',
          verifyToken: 'doesthisworkyet',
        },
        transloadit: {
          media: {
            auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
            template_id: 'dd77fc95cfff48e8bf4af6159fd6b2e7'
          },
          profile: {
            auth: {key: '8a36aa56062f49c79976fa24a74db6cc'},
            template_id: 'ddc4239217f34c8185178d2552f8ef9a'
          }
        },
        cloudfront: {
          img: 'https://d1da6a4is4i5z6.cloudfront.net/',
          vid: 'https://d1ehvayr9dfk4s.cloudfront.net/',
          aud: 'https://dp3piv67f7p06.cloudfront.net/',
          build: 'https://d10fiv677oa856.cloudfront.net'
        },
        cartodb: {
          user: 'island',
          api_key: '883965c96f62fd219721f59f2e7c20f08db0123b',
          tables: {
            medias: 'medias',
            instagrams: 'instagrams',
          }
        },
        gmail: {
          user: 'robot@island.io',
          password: 'I514nDr06ot',
          from: 'Island <robot@island.io>',
          host: 'smtp.gmail.com',
          ssl: true
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
