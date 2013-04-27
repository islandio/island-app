/*
 * Chat List view
 */

define([
  // dependencies
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'text!../../../templates/lists/chat.html',
  'collections/chat',
  'views/rows/message'
], function ($, _, List, mps, template, Collection, Row) {
  return List.extend({
    
    el: '#shell-chat',

    initialize: function (options) {
      var self = this;
      this.template = _.template(template);
      this.collection = new Collection;
      this.Row = Row;
      this.collection.on('add', _.bind(this.render, this));
      mps.subscribe('bus/chat/new', _.bind(this.collect, this, 'c'));
      mps.subscribe('bus/chat/event', _.bind(this.collect, this, 'e'));
      List.prototype.initialize.call(this, options);
    },

    collect: function (type, topic, data) {
      if (this.parentView.model.id === data.parent_id)
        this.collection.push(_.extend(data, { _type: type }));
    },

    render: function (options) {
      List.prototype.render.call(this, options);
      if (this.collection.models.length > 0)
        this.scroll();
      return this;
    },

    scroll: function () {
      if (this.el.scrollHeight > this.$el.height())
        this.$el.scrollTo(this.el.scrollHeight - this.$el.height());
      return this;
    }

  });
});
