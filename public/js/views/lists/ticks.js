/*
 * Sidebar List view.
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/ticks.html',
  'views/rows/tick.compact'
], function ($, _, Backbone, mps, util, template, Row) {
  return List.extend({

    initialize: function (app, options) {
      this.template = _.template(template);
      this.Row = Row;
      this.type = options.type;
      this.subtype = options.subtype;
      this.heading = options.heading;
      this.setElement(options.parentView.$('.sidebar-' + this.type + 's'
          + (options.subtype ? '-' + options.subtype: '')));

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Socket subscriptions
      _.bindAll(this, 'collect', '_remove');
      this.app.rpc.socket.on('tick.new', this.collect);
      this.app.rpc.socket.on('tick.removed', this._remove);

      // Reset the collection.
      var items = _.filter(this.app.profile.content.ticks.items,
          _.bind(function (i) {
        return i.subscribee.type === this.subtype;
      }, this));
      this.collection.reset(items);
    },

    setup: function () {
      return List.prototype.setup.call(this);
    },

    events: {},

    destroy: function () {
      this.app.rpc.socket.removeListener('tick.new', this.collect);
      this.app.rpc.socket.removeListener('tick.removed', this._remove);
      return List.prototype.destroy.call(this);
    },

    collect: function (data) {
      var id = this.parentView.model ? this.parentView.model.id:
          this.app.profile.member.id;
      if (data.subscriber.id === id && data.meta.type === this.type) {
        if (data.subscribee.type === this.subtype) {
          this.collection.unshift(data);
        }
      }
    },

    _remove: function (data) {
      var index = -1;
      var view = _.find(this.views, function (v) {
        ++index;
        return v.model.id === data.id;
      });

      if (view) {
        this.views.splice(index, 1);
        if (this.app.profile.content.private) {
          view.destroy();
          this.collection.remove(view.model);
        } else {
          view._remove(_.bind(function () {
            this.collection.remove(view.model);
          }, this));
        }
      }
    },

  });
});



//   return Backbone.View.extend({

//     el: '.sidebar-ticks',
//     ticks: [],

//     initialize: function (app) {
//       this.app = app;
//       this.subscriptions = [];

//       // Socket subscriptions
//       _.bindAll(this, 'collect', '_remove');
//       this.app.rpc.socket.on('tick.new', this.collect);
//       this.app.rpc.socket.on('tick.removed', this._remove);

//       this.on('rendered', this.setup, this);
//     },

//     events: {
//       'click .tick-inner': function (e) {
//         var t = $(e.target);
//         if (!t.is('a') && !t.is('time')) {
//           var key = t.closest('.tick-inner').data('key');
//           this.app.router.navigate('/efforts/' + key, {trigger: true});
//         }
//       },
//       'click .navigate': 'navigate'
//     },

//     render: function () {
//       this.template = _.template(template);
//       this.$el.html(this.template.call(this));

//       // Render each tick as a view.
//       var items = this.app.profile.content.ticks.items;
//       var ticks = this.$('.tick');
//       _.each(ticks, _.bind(function (el, i) {
//         _.defer(_.bind(function () {
//           el = $(el);
//           var data = _.find(items, function (t) {
//             return t.id === el.attr('id');
//           });
//           this.ticks.push(new Tick({
//             parentView: this,
//             el: el,
//             model: data,
//             mapless: true,
//             medialess: true,
//             commentless: true,
//             showCragName: true,
//             inlineDate: true
//           }, this.app).render());
//         }, this));
//       }, this));

//       this.trigger('rendered');
//       return this;
//     },

//     setup: function () {
//       return this;
//     },

//     collect: function (data) {
//       if (data.sent && data.private !== false) {
//         this._remove(data, true);
//         var el = $('<li class="tick" id="' + data.id + '" data-type="'
//             + data.type + '">');
//         var grade;
//         if (isNaN(Number(data.grade))) {
//           grade = 'not graded by you';
//         } else {
//           grade = this.app.gradeConverter[data.type].indexes(data.grade);
//         }
//         el.prependTo(this.$el)

//         // create new tick view
//         this.ticks.push(new Tick({
//           parentView: this,
//           el: el,
//           model: data,
//           mapless: true,
//           medialess: true,
//           commentless: true,
//           showCragName: true,
//           inlineDate: true
//         }, this.app).render());
//       }
//     },

//     _remove: function (data, noslide) {
//       var t = _.find(this.ticks, function (t) {
//         return t.model.id === data.id;
//       });
//       if (!t) {
//         return;
//       }

//       this.ticks = _.reject(this.ticks, function (t) {
//         return t.model.id === data.id;
//       });
//       var list = this.$el;

//       function _done() {
//         t.destroy();
//         if (list.children('li').length === 0) {
//           list.hide();
//         }
//       }

//       noslide ? _done.call(this): t.$el.slideUp('fast', _.bind(_done, this));
//     },

//     destroy: function () {
//       this.app.rpc.socket.removeListener('tick.new', this.collect);
//       this.app.rpc.socket.removeListener('tick.removed', this._remove);
//       _.each(this.subscriptions, function (s) {
//         mps.unsubscribe(s);
//       });
//       _.each(this.ticks, function (t) {
//         t.destroy();
//       });
//       this.undelegateEvents();
//       this.stopListening();
//       this.remove();
//     },

//     navigate: function (e) {
//       e.preventDefault();
//       var path = $(e.target).closest('a').attr('href');
//       if (path) {
//         this.app.router.navigate(path, {trigger: true});
//       }
//     },

//   });
// });
