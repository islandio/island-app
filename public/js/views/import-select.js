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
  'views/rows/tick',
  'text!../../templates/import.select.html'
], function ($, _, Backbone, mps, rpc, rest, util, Spin, Tick, template) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.ticks = [];

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
      this.spin = new Spin(this.$('.import-spin'));
      this.spin.start();

      this.app.rpc.do('get8aTicks', this.options.userId, _.bind(function (err, ticks) {
        if (err) return console.log(err);
        this.spin.stop();
        this.ticks = ticks;
        ticks = _.sortBy(ticks, 'grade').reverse();
        console.log(ticks);

        _.each(ticks, _.bind(function (tick, i) {

          $('.session-ticks').append('<li class="tick" id="import-tick-'+i+'"></li>');

          new Tick({
            parentView: this,
            el: $('#import-tick-'+i),
            model: tick,
            mapless: true,
            medialess: true,
            commentless: true,
            inlineWeather: false,
            inlineDate: true
          }, this.app).render();

          var row = '<tr><td>'
            + new Date(tick.date).toLocaleDateString({}, {timeZone: 'UTC'}) + '</td><td>'
            + tick.type + '</td><td>'
            + tick.crag.name + '</td><td>'
            + tick.ascent.name + '</td><td>'
            + tick.grade + '</td><td>'
            + tick.tries + '</td><td>'
            + tick.first + '</td><td>'
            + tick.feel + '</td><td>'
            + tick.rating + '</td><td>'
            + tick.recommended + '</td><td>'
            + tick.note + '</td></tr>';
          $('.import-table').append(row);
        }, this));
      }, this));

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
      if (!this.ticks.length === 0) return;

      var payloads = _.map(this.ticks, function(t) {
        var payload = {
          cragName: t.crag,
          date: t.date
        };
        delete t.crag;

        t.index = 0;
        t.ascentName = t.ascent;
        delete t.ascent;

        // some legacy stuff going on here
        var action = {ticks: [t]};
        var actions = [action];
        payload.actions = actions;
        return payload;
      });

      this.spin.start();
      var next = _.after(payloads.length, _.bind(function() {
        this.spin.stop();
      }, this));

      _.each(payloads, function(p) {
        rest.post('/api/sessions/', p, next);
      });

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
