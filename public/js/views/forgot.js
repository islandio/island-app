/*
 * Forgot password view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'text!../../templates/forgot.html'
], function ($, _, Backbone, mps, rest, util, template) {
  return Backbone.View.extend({

    className: 'forgot',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .modal-confirm': 'send',
      'click .modal-cancel': 'cancel',
      'submit form': 'send'
    },

    setup: function () {

      // Save refs.
      this.input = this.$('input[name="email"]');

      // Focus cursor initial.
      _.delay(_.bind(function () { this.input.focus(); }, this), 1);

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    send: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = {email: this.input.val().trim()};

      // Client-side form check.
      var errorMsg = this.$('.modal-error');
      var check = util.ensure(payload, ['email']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('input[name="' + m + '"]');
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        errorMsg.text(msg);

        return false;
      }
      if (!util.isEmail(payload.email)) {

        // Set the error display.
        this.input.val('').addClass('input-error').focus();
        var msg = 'Please use a valid email address.';
        errorMsg.text(msg);

        return false;
      }

      rest.post('/api/members/forgot', payload, _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          if (err.code === 404) {
            errorMsg.text('Sorry, we could not find your account.');
          } else if (err.message === 'No password') {
            var provider = _.str.capitalize(err.data.provider);
            errorMsg.html('Oops, this account was created via ' + provider
                + '. <a href="/auth/' + err.data.provider
                + '">Reconnect with ' + provider + '</a>.');
          } else {
            errorMsg.text(err.message);
          }

          // Clear fields.
          this.input.val('').addClass('input-error').focus();

          return;
        }

        // Inform user.
        mps.publish('flash/new', [{
          message: 'Check your inbox for a link to reset your password.',
          level: 'alert',
          sticky: true
        }, true]);

        $.fancybox.close();

      }, this));

      return false;
    },

    cancel: function (e) {
      e.preventDefault();
      $.fancybox.close();
    }

  });
});
