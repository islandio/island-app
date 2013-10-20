/*
 * Reset password view.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'text!../../templates/reset.html'
], function ($, _, Backbone, mps, rpc, util, template) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    el: '.main',

    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;
      
      // Shell events:
      this.on('rendered', this.setup, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Set page title
      this.app.title('Password Reset');

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .reset-button': 'reset',
      'click .forgot-password': 'forgot',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.oldPassword = this.$('input[name="oldpassword"]');
      this.newPassword = this.$('input[name="newpassword"]');
      this.cnewPassword = this.$('input[name="cnewpassword"]');

      // Remove the old password field if token exists.
      this.token = util.getParameterByName('t');
      if (this.token) {
        this.oldPassword.closest('tr').remove();
        this.$('label[for="oldpassword"]').closest('tr').remove();
      }

      // Focus cursor initial.
      _.delay(_.bind(function () { this.focus(); }, this), 1);

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) $(i).focus();
        return empty;
      });
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

    // Do the reset.
    reset: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = this.$('form').serializeObject();

      // Client-side form check.
      var errorMsg = this.$('.signin-error').hide();
      var fields = ['newpassword', 'cnewpassword'];
      if (!this.token) fields.push('oldpassword');
      var check = util.ensure(payload, fields);

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
        errorMsg.text(msg).show();

        return false;
      }

      // Add token.
      if (this.token) payload.token = this.token;

      // Now do the update.
      rpc.post('/api/members/reset', payload,
          _.bind(function (err, data) {
        if (err) {

          // Set the error display.
          errorMsg.text(err.message + '.').show();

          // Clear fields.
          this.$('input[type="password"]').val('').addClass('input-error');
          this.focus();

          return;
        }

        // Clear fields.
        this.$('input[type="password"]').val('');
        this.focus();

        // Inform user.
        mps.publish('flash/new', [{
          message: 'Your password has been reset.',
          level: 'alert'
        }, true]);

        // Go home.
        this.app.router.navigate('/', true);

      }, this));

      return false;
    },

    forgot: function (e) {
      e.preventDefault();

      // Render the modal view.
      mps.publish('member/forgot/open');
    },

  });
});
