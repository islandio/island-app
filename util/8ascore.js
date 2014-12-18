#!/usr/bin/env node
/*
 * index.js: Index all members, posts, crags, and ascents for search.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
var request = require('request');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var log = function (s) {console.log(clc.bold(s));};
var clc = require('cli-color');
var cheerio = require('cheerio');
clc.orange = clc.xterm(202);

// Default request headers:
var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) '
                + 'AppleWebKit/537.17 (KHTML, like Gecko) '
                + 'Chrome/24.0.1312.57 Safari/537.17',
};


var member = 'Lucas Marques';
//var member = 'Sander Pick';

var member_rx = new RegExp(/Profile\.aspx\?UserId=([0-9]+)\'>(.*?)<.*?<nobr>(.+?)<.*?<td>(.*?)</g);

var searchResults = [];

boots.start(function (client) {

  log(clc.blackBright('Searching for member ' + member + '...'));

  Step(
    function getPostHeaders() {
      request.get({
        uri: 'http://www.8a.nu/scorecard/Search.aspx',
        qs: {CountryCode: 'GLOBAL'},
        headers: headers,
        encoding: 'binary'
      }, this);
    },

    function searchMember(err, res, body) {
      viewState_rx = new RegExp(/id=\"__VIEWSTATE\" value=\"([A-Za-z0-9+/=]+)/);
      eventValidation_rx = new RegExp(/id=\"__EVENTVALIDATION\" value=\"([A-Za-z0-9+/=]+)/);

      var form = {
        __EVENTTARGET: undefined,
        __EVENTARGUMENT: undefined,
        __VIEWSTATE: viewState_rx.exec(body)[1],
        __VIEWSTATEGENERATOR:'BE3FD81F',
        __EVENTVALIDATION: eventValidation_rx.exec(body)[1],
        ListboxRorBSimple: 0,
        TextboxAscentCragSimple: undefined,
        ListBoxAscentCountry: undefined,
        TextboxMemberName: member,
        ListBoxSearchUserSex: 2,
        TextboxMemberCity: undefined,
        ListBoxSearchUserCountry: undefined,
        ButtonSearchMember: 'Search',
        TextboxAscentSector: undefined
      };

      request.post({
        uri: 'http://www.8a.nu/scorecard/Search.aspx',
        qs: {CountryCode: 'GLOBAL'},
        form: form,
        headers: headers,
        encoding: 'binary',
      }, this)
    },
    function (err, res, body) {
      var results;
      while (results = member_rx.exec(body)) {
        searchResults.push({
          userId: results[1],
          name: results[2],
          city: results[3],
          country: results[4]
        });
      }
      if (searchResults.length === 0) {
        log(clc.blackBright('No results found ...'));
        process.exit(0);
      }

      // Get the javascript file that contains the ascent URLs
      request.get({
        uri: 'http://www.8a.nu/js/u_common.aspx?UserId=' + searchResults[0].userId,
        headers: _.extend(headers, {'Referer': 'http://www.8a.nu/user/Profile.aspx?UserId' + searchResults[0].userId}),
        encoding: 'binary',
      }, this);

    },
    function (err, res, body) {
      var sandbox = {};
      // Run javascript in a new context to get bouldering/route URLs
      require('vm').runInNewContext(body, sandbox);
      // bouldering ascent
      var url_rx = new RegExp(/<a href="\.\.(.*?)"/);
      var d = 'http://www.8a.nu';
      var boulderUrl = d + url_rx.exec(sandbox['A8_sc_b'])[1];
      var routeUrl = d + url_rx.exec(sandbox['A8_sc_r'])[1];

      request.get({
        uri: boulderUrl,
        headers: headers,
        encoding: 'binary',
      }, this.parallel());

      request.get({
        uri: routeUrl,
        headers: headers,
        encoding: 'binary',
      }, this.parallel());

    },
  function (err, boulders, routes) {

    // image hashes map to Island's 'tries'
    var triesMap = {
      // redpoints
      '979607b133a6622a1fc3443e564d9577': 3,
      // flashes
      '56f871c6548ae32aaa78672c1996df7f': 2,
      // onsights
      'e9aec9aee0951ec9abfe204498bf95f9': 1,
      'e37046f07ac72e84f91d7f29f8455b58': 1,
    }

    var userRecommend = function(str) {
      return str.indexOf('images/UserRecommended_1') !== -1;
    };

    // filter for ascents
    var ascents_rx = new RegExp(/<!-- Ascents -->([\s\S]+?)<!-- List Options -->/);
    var bouldersHtml = ascents_rx.exec(boulders.body)[1];
    var routesHtml = ascents_rx.exec(routes.body)[1];

    // parse HTML into a DOM structure
    var $ = cheerio.load(bouldersHtml);

    var createTickObj = function(els) {
      // Parse rows for Island tick props
      var obj =  ({
        type: 'b',
        date: new Date('20' + $(els.get(0)).find('nobr').text()),
        sent: true,
        tries: triesMap[$(els.get(1)).find('img').attr('src')
            .split('/')[1].split('.')[0]],
        ascent: $(els.get(2)).find('a').text(),
        recommended: userRecommend($(els.get(3)).find('img').attr('src')),
        crag: $(els.get(4)).find('span').text(),
        first: $(els.get(5)).text().indexOf('FA') ? true : false,
        feel: $(els.get(5)).text().indexOf('Soft') ? -1 :
            $(els.get(5)).text().indexOf('Hard') ? 1 : 0,
        note: $(els.get(6)).contents().filter(function() {
          return this.nodeType == 3
        }).text(),
        rating: ($(els.get(7)).text().match(/\*/g) || []).length
      });
      return obj;
    }

    var bouldersTicks = [];
    $('.AscentListHeadRow').each(function() {
      $(this).parent().nextUntil('tr:has(td:only-child)')
          .each(function() {
        var els = $(this).children();
        var tick = createTickObj(els);
        tick.type = 'b';
        bouldersTicks.push(tick);
      });
    });

    console.log('boulder tick list');
    console.log(bouldersTicks);

    var $ = cheerio.load(routesHtml);
    var routeTicks = [];
    $('.AscentListHeadRow').each(function() {
      $(this).parent().nextUntil('tr:has(td:only-child)')
          .each(function() {
        var els = $(this).children();
        var tick = createTickObj(els);
        tick.type = 'r';
        routeTicks.push(tick);
      });
    });

    console.log('Route tick list');
    console.log(routeTicks);

    process.exit(0);
  }

  );

});
