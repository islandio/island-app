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
clc.orange = clc.xterm(202);

// Default request headers:
var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) '
                + 'AppleWebKit/537.17 (KHTML, like Gecko) '
                + 'Chrome/24.0.1312.57 Safari/537.17',
};

// Form for searching for members

function get(userid, cb) {

  log(clc.blackBright('Getting scorecard...'));

  request.get({
    uri: 'http://www.8a.nu/scorecard/AscentList.aspx',
    qs: {
      UserId: 55531,
      AscentType: 0,
      AscentClass: 0,
      AscentListTimeInterval: 1,
      AscentListViewType: 0,
      GID: '4e7f2433aee783248e8e0a4c17024a9f'
    },
    headers: headers,
    encoding: 'binary'
  }, function(err, res) {
    console.log(res.body);
    cb(null);
  })

}

var member = 'Winterleitner';

var member_rx = new RegExp(/Profile\.aspx\?UserId=([0-9]+)\'>(.*?)<.*?<nobr>(.+?)<.*?<td>(.*?)</g);

var searchResults = [];

boots.start(function (client) {

  log(clc.blackBright('Searching ...'));

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
      console.log('searchMember');
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

      console.log(form);

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

    // Only try to figure this out if you want your eyes to bleach
    console.log('**BEGIN BOULDERS**');
    console.log(boulders.body)
    console.log('**END BOULDERS**');
    console.log('**BEGIN ROUTES**');
    console.log(routes.body)
    console.log('**END ROUTEs**');

    var ascent_rx = new RegExp(/<tr[\s\S]*?<td valign[\s\S]*?<nobr>([0-9\-]*?)<\/nobr>[\s\S]*?<img src="images\/(.*?).gif[\s\S]*?=1'>(.*?)<\/a>[\s\S]*?\)">(.*?)<\/a>[\s\S]*?<\/td>[\s\S]*?<\/td>[\s\S]*?<\/span>(.*?)<\/td>[\s\S]*?>([*]*)[\s\S]*?<\/tr>/g);

    var results;
    console.log('boulders');
    console.log(boulders.body);
    while (results = ascent_rx.exec(boulders.body)) {
      console.log(results[1], results[2], results[3], results[4], results[5], results[6]);
    }
    console.log('routes');
    while (results = ascent_rx.exec(routes.body)) {
      console.log(results[1], results[2], results[3], results[4], results[5], results[6]);
    }
    process.exit(0);
  }

  );

});
