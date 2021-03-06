/*
 * Event Row view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/row',
  'mps',
  'rest',
  'text!../../../templates/rows/event.html',
  'views/rows/session',
  'views/rows/tick',
  'views/rows/post',
  'views/rows/crag',
  'views/rows/ascent'
], function ($, _, Row, mps, rest, template, Session, Tick, Post, Crag,
      Ascent) {
  return Row.extend({

    attributes: function () {
      return _.defaults({class: 'event'},
          Row.prototype.attributes.call(this));
    },

    initialize: function (options, app) {
      this.app = app;
      this.template = _.template(template);
      Row.prototype.initialize.call(this, options);
    },

    render: function (single, prepend) {
      Row.prototype.render.call(this, single, prepend);
      this.$el.prev('.event-divider').show();

      // Determine sub view type.
      var Action;
      switch (this.model.get('action_type')) {
        case 'session': Action = Session; break;
        case 'tick': Action = Tick; break;
        case 'post': Action = Post; break;
        case 'crag': Action = Crag; break;
        case 'ascent': Action = Ascent; break;
      }

      // Render action as sub-view.
      if (Action) {
        var model = this.model.get('action');
        model.event = this.model.get('data');
        var params = {
          parentView: this,
          model: model
        };
        if (this.model.get('action_type') === 'tick') {
          params.mapless = true;
          params.inlineWeather = true;
          params.inlineTime = true;
          var containerType = this.parentView.parentView.model ?
              this.parentView.parentView.model.get('type'): null;
          // Show ascentionist name not ascent name on ascent pages.
          if (containerType === 'b' || containerType === 'r') {
            params.showAuthorName = true;
            params.showAscentName = false;
          }
        }
        this.action = new Action(params, this.app).render(true);
      }

      return this;
    },

    setup: function () {
      this.$('.tooltip').tooltipster({delay: 300, multiple: true});
      Row.prototype.setup.call(this);
    },

    destroy: function () {
      if (this.action) {
        this.action.destroy();
      }
      Row.prototype.destroy.call(this);
    },

    _remove: function (cb) {
      this.$el.slideUp('fast', _.bind(function () {
        this.destroy();
        cb();
      }, this));
    },

  });
});
