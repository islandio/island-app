/*
 * Choice Row view
 */

define([
  'jQuery',
  'Underscore',
  'mps',
  'views/boiler/row',
  'text!../../../templates/rows/choice.html'
], function ($, _, mps, Row, template) {
  return Row.extend({

    tagName: 'a',

    attributes: function () {
      return _.defaults({class: 'choice'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {

      // Add extra data.
      this.$el.attr({href: this.model.href()});
      this.$el.attr({'data-term': this.model.term()});

      return Row.prototype.render.call(this, single, prepend);
    },

    events: {
      'click': 'choose',
      'click .list-button': 'log'
    },

    choose: function (e) {
      if (e) {
        e.preventDefault();
        if ($(e.target).hasClass('list-button')
            || $(e.target).hasClass('icon-pencil')) {
          return false;
        }
      }

      // Show selection.
      this.parentView.choose(this);

      if (!this.parentView.options.route) return;

      // Set map view.
      var geometry = this.model.get('geometry');
      if (geometry) {
        var location = {
          latitude: geometry.location.lat(),
          longitude: geometry.location.lng()
        };
        mps.publish('map/fly', [location]);
        return;
      }

      // Go to page.
      this.app.router.navigate(this.$el.attr('href'), {trigger: true});
    },

    log: function (e) {
      if (this.model.get('_type') === 'crag')
        mps.publish('session/new', [{crag_id: this.model.id}]);
      else
        mps.publish('session/new', [{ascent_id: this.model.id}]);
    }

  });
});
