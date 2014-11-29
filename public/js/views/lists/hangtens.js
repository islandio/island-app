/*
 * Hangtens List view
 */

define([
  'jQuery',
  'Underscore',
  'views/boiler/list',
  'mps',
  'rest',
  'util',
  'text!../../../templates/lists/hangtens.html',
  'collections/hangtens'
], function ($, _, List, mps, rest, util, template, Collection) {
  return List.extend({
    
    el: '.hangtens',
    working: false,

    initialize: function (app, options) {
      this.template = _.template(template);
      this.collection = new Collection;
      this.type = options.type;

      // Call super init.
      List.prototype.initialize.call(this, app, options);

      // Client-wide subscriptions
      this.subscriptions = [];

      // Socket subscriptions
      this.app.rpc.socket.on('hangten.new', _.bind(this.collect, this));
      this.app.rpc.socket.on('hangten.removed', _.bind(this._remove, this));

      // Reset the collection.
      this.collection.reset(this.parentView.parentView.model.get('hangtens'));
    },

    render: function (options) {

      // Determine if member has already hangtened.
      var member = this.app.profile.member;
      this.hangtened = member ? _.find(this.collection.models, function (h) {
        return h.get('author_id') === member.id;
      }): false;

      // Set link text.
      if (this.button) this.setButtonText();

      List.prototype.render.call(this, options);

      // Hide if empty.
      if (this.collection.length > 0) this.$el.show();
      else this.$el.hide();

      return this;
    },

    renderLast: function () {
      this.render();
    },

    setup: function () {

      // Save refs.
      this.button = this.parentView.parentView.$('.hangten');

      // Set link text.
      this.setButtonText();

      // Add click event.
      this.button.bind('click', _.bind(this.toggle, this));

      return List.prototype.setup.call(this);
    },

    destroy: function () {
      // this.app.rpc.socket.removeAllListeners('hangten.new');
      // this.app.rpc.socket.removeAllListeners('hangten.removed');
      return List.prototype.destroy.call(this);
    },

    // Bind mouse events.
    events: {
      'click .hangten': 'add'
    },

    // Collect new data from socket events.
    collect: function (data) {
      if (data.parent_id === this.parentView.parentView.model.id
        && !this.collection.get(-1))
        this.collection.push(data);
    },

    // remove a model
    _remove: function (data) {
      this.collection.remove(this.collection.get(data.id));
      this.render();
    },

    setButtonText: function () {
      if (this.hangtened) this.button.text('UnhangTen');
      else this.button.text('HangTen');
    },

    // Add or remove hangten
    toggle: function (e) {
      e.preventDefault();
      if (this.working) return false;
      this.working = true;
      if (this.hangtened) this.unhangten();
      else this.hangten();
      return false;
    },

    // Add a hangten
    hangten: function () {

      // Mock hangten.
      var data = {
        id: -1,
        author_id: this.app.profile.member.id,
        created: new Date().toISOString()
      };

      // Optimistically add hangten to page.
      this.collection.push(data);

      // Now save the hangten to server.
      rest.post('/api/hangtens/' + this.parentView.type,
          {parent_id: this.parentView.parentView.model.id},
          _.bind(function (err, data) {
        if (err) {
          this.collection.pop();
          return console.log(err);
        }

        // Update the hangten id.
        var hangten = this.collection.get(-1);
        hangten.set('id', data.id);
        this.working = false;
      }, this));
    },

    // Remove a hangten
    unhangten: function () {
      rest.delete('/api/hangtens/' + this.hangtened.id, {});
      this._remove({id: this.hangtened.id});
      this.working = false;
    }

  });
});
