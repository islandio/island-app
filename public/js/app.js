/*
 * Hylo application.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'router',
  'bus',
  'rpc'
], function ($, _, Backbone, Router, bus, rpc) {

  // For dev:
  window._bus = bus;
  window._rpc = rpc;

  var App = function () {

    // The maximum idea investment in Hylos:
    this.investmentThreshold = 3;

    // Balanced Marketplace location:
    this.marketplaceURI = window.__hv ? '/v1/marketplaces/MP54tdO4Pk6RnewC1MJxDfQq'
                                : '/v1/marketplaces/TEST-MP2p7u49Y6qrkBhXa4m4bTaS';
    
    // Location of static assets:
    this.cloudFrontURL = 'https://d2nwkk2kh4qkau.cloudfront.net';
  }

  App.prototype.update = function (profile) {

    // Set the app profile model.
    this.profile = new Backbone.Model(profile);

    // Open a channel on the bus.
    if (!bus.channel() && this.profile.get('person')) bus.init();
  }

  return {

    // Creates the instance.
    init: function () {
      var app = new App;
      app.router = new Router(app);
      Backbone.history.start({ pushState: true });
    }
    
  };
});
