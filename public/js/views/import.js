/*
 * Page view for crags.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'rest',
  'util',
  'Spin',
  'text!../../templates/import.search.html',
], function ($, _, Backbone, mps, rpc, rest, util, Spin, template) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];

      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | Import');

      this.template = _.template(template);
      $(this.template.call(this)).appendTo('.main');

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .button': 'submit',
    },

    setup: function () {
      this.spin = new Spin(this.$('.button-spin'));
      this.noResults = $('.no-results');
      this.list = $('.list-wrap .list');
      this.input = $('.import-input');

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

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    submit: function (e) {
      if (this.searching) return;
      this.list.empty();
      this.noResults.hide();
      this.input.removeClass('input-error');

      var member = this.input.val();
      this.spin.start();
      this.searching = true;
      this.app.rpc.do('get8aUser', member, _.bind(function (err, res) {

        this.searching = false;
        this.spin.stop();

        if (err) {
          this.input.addClass('input-error');
          return console.log(err);
        }

        if (!res || res.length === 0) return this.noResults.show();

        _.each(res, _.bind(function(member) {
          this.list.append('<li> <a href="/import/' + member.userId + '">' + member.name
              + ' ' + member.city + ',' + member.country + '</a></li>')
        }, this));

      }, this));
    }

  });
});
