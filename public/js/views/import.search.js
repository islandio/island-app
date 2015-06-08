/*
 * Page view for import search.
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
  'views/lists/watchees'
], function ($, _, Backbone, mps, rpc, rest, util, Spin, template, Watchees) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];

      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | 8a.nu Import');

      this.template = _.template(template);
      $(this.template.call(this)).appendTo('.main');

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'click .button': 'submit',
      'keydown .import-input': 'keydown',
      'change input[type="radio"]': 'updateRadio'
    },

    setup: function () {
      this.spin = new Spin(this.$('.button-spin'));
      this.noResults = $('.no-results');
      this.list = this.$('.list-wrap .list');
      this.input = this.$('.import-input');
      this.button = this.$('.button');

      // Render lists.
      this.crags = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'crag', heading: 'Crags'});
      this.sroutes = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'r', heading: 'Routes'});
      this.sboulders = new Watchees(this.app, {parentView: this, reverse: true,
          type: 'ascent', subtype: 'b', heading: 'Boulders'});

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    updateRadio: function() {
    /*
      var val = $('input[type="radio"]:checked').val();
      var placeholder = '';
      if (val.indexOf("8a") !== -1)
        placeholder = "Enter your full name";
      else if (val.indexOf("27crags") !== -1)
        placeholder = "Enter your 27crags username"
      this.input.attr('placeholder', placeholder);
    */
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.crags.destroy();
      this.sroutes.destroy();
      this.sboulders.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    keydown: function (e) {
      if (e.keyCode === 13) this.submit();
      return true;
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

      this.spin.start();
      this.button.addClass('spinning').addClass('disabled').attr('disabled', true);
      this.searching = true;
      var rpcData = { 
        userId: this.input.val(),
        from: $('input[type=radio]:checked').val()
      };

      this.app.rpc.do('getUser', rpcData, _.bind(function (err, res) {

        this.searching = false;
        this.spin.stop();
        this.button.removeClass('spinning').removeClass('disabled').attr('disabled', false);

        if (err) {
          this.input.addClass('input-error');
          return console.log(err);
        }

        if (!res || res.length === 0) return this.noResults.show();

        _.each(res, _.bind(function(member) {
          var slug = (member.name + ' ' + member.userId)
              .toLowerCase()
              .replace(/[^\w ]+/g,'')
              .replace(/ +/g,'-');
          this.list.append('<li>' +
              '<a class="navigate" href="/import/' + slug + '">' +
              '<i class="icon-user"></i>' +
              '<b>' + member.name + '</b>&nbsp' +
              '<span>' + member.city + ', ' + member.country + '</span>' +
              '</a></li>');
        }, this));

      }, this));
    }

  });
});
