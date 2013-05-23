/*
 * Login view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'swfobject'
], function ($, _, Backbone, mps, rpc, util, swfobject) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    el: '#main',
    
    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;
      
      // Shell events:
      this.on('rendered', this.setup, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Embed the background video.
      swfobject.embedSWF(
          'https://d271mvlc6gc7bl.cloudfront.net/main/swf/roll4.swf',
          'roll', '100%', '100%', 10, '', {}, {menu: 'false'}, {});

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // // Focus on the first highlighted and empty input field:
      // _.find(this.$('.highlight input[type!="submit"]'),
      //       function (i) {
      //   var empty = $(i).val().trim() === '';
      //   if (empty) $(i).focus();
      //   return empty;
      // });

      // Init form handling:
      // util.initForm(this.$('form'));

      return this;
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    // Bind mouse events.
    events: {
      // 'click #log_in': 'login',
      // 'click #sign_up': 'signup'
    },

    login: function (e) {
      e.preventDefault();

      // Grab the form data.
      var form = this.$('form#login_form');
      var payload = form.serializeObject();

      // Try to login:
      rpc.execute('/service/person.login', payload, {
        success: _.bind(function (data) {

          if (data.person)
            // Route to home:
            this.app.router.navigate('/', {trigger: true});
          else {
            var flash = {message: data.error, level: 'error'};
            mps.publish('flash/new', [flash, true]);
            if (data.missing)
              $('input[name="' + data.missing + '"]', form).addClass('input-error');
          }

        }, this),

        error: function (x) {

          // TODO: render 404.
          console.warn(x);
        }
      });

      return false;
    },

    signup: function (e) {
      e.preventDefault();

      // Grab the form data.
      var form = this.$('form#signup_form');
      var payload = form.serializeObject();

      // Try to create a new person:
      rpc.execute('/service/person.create', payload, {
        success: _.bind(function (data) {

          if (data.person)
            // Route to home:
            this.app.router.navigate('/', {trigger: true});
          else {
            var flash = {message: data.error, level: 'error'};
            mps.publish('flash/new', [flash, true]);
            if (data.missing)
              $('input[name="' + data.missing + '"]', form).addClass('input-error');
          }

        }, this),

        error: function (x) {

          // TODO: render 404.
          console.warn(x);
        }
      });

      return false;
    },

  });
});
