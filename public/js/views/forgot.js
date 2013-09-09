/*
 * Forgot password view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'text!../../templates/forgot.html'
], function ($, _, Backbone, mps, rpc, util, template) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    className: 'forgot',

    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #forgot_send': 'send',
      'click #forgot_cancel': 'cancel',
      'submit form': 'send'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.input = this.$('input[name="email"]');
      this.overlay = this.$('.modal-overlay');

      // Focus cursor initial.
      _.delay(_.bind(function () { this.input.focus(); }, this), 1);

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

    send: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = {email: this.input.val().trim()};

      // Client-side form check.
      var errorMsg = this.$('.signin-error');
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

      // Show the in-modal overlay.
      this.overlay.show();

      // Do the API request.
      rpc.post('/api/members/forgot', payload, _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          this.overlay.hide();
          if (err.code === 404)
            errorMsg.text('Sorry, we could not find your account.');
          else if (err.message === 'No password') {
            var provider = _.str.capitalize(err.data.provider);
            errorMsg.html('Oops, this account was created via ' + provider
                + '. <a href="/auth/' + err.data.provider
                + '">Reconnect with ' + provider + '</a>.');
          } else errorMsg.text(err.message);

          // Clear fields.
          this.input.val('').addClass('input-error').focus();

          return;
        }

        // Change overlay message.
        $('p', this.overlay).text('Check your inbox. - Love, Island');

        // Wait a little then close the modal.
        _.delay(_.bind(function () {
          $.fancybox.close();
        }, this), 2000);

      }, this));

      return false;
    },

    cancel: function (e) {
      e.preventDefault();
      $.fancybox.close();
    }

  });
});
