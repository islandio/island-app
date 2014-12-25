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
      $('.list-wrap').empty().hide();
      $('.no-results').hide();

      var member = $('.import-input').val();
      this.spin.start();
      this.app.rpc.do('get8aUser', member, _.bind(function (err, res) {
        if (err) return console.log(err);
        this.spin.stop();

        if (!res.length) return $('.no-results').show();

        $('.list-wrap').append('<ul class="list">')
        _.each(res, function(member) {
          $('.list-wrap').append('<li> <a href="/import/' + member.userId + '">' + member.name
              + ' ' + member.city + ',' + member.country + '</a></li>')
        });
        $('.list-wrap').append('</ul').show();

      }, this));
    }

/*
    search: function (e) {
      this.noresults.hide();

      // Clean search string.
      var str = util.sanitize(this.input.val());

      // Handle interaction.
      if (str === this.str) {
        if (this.num === 0 && str !== '') {
          this.noresults.show();
        }
        return false;
      }
      this.str = str;
      $('.list', this.results).remove();

      if (str === '') {
        this.app.router.navigate('crags', {trigger: false, replace: true});
        return false;
      }

      // Call server.
      this.spin.start();
      rest.post('/api/crags/search/' + str, {}, _.bind(function (err, data) {
        if (err) {
          return console.log(err);
        }
        this.spin.stop();

        // Update URL.
        var c = !data.params.country || data.params.country === '' ?
            '': '/' + data.params.country;
        var q = !data.params.query || data.params.query === '' ?
            '': '?q=' + data.params.query;
        this.app.router.navigate('crags' + c + q,
            {trigger: false, replace: true});

        // Save count.
        this.num = data.items.length;
        if (data.items.length === 0) {
          return this.noresults.show();
        }

        // Render results.
        $(this.list.call(this, data)).appendTo(this.results);
      }, this));

      return false;
    },
    */

  });
});
