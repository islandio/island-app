/*
 * Sharing view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'text!../../templates/share.html',
  'Share'
], function ($, _, Backbone, mps, rest, util, template, Share) {
  return Backbone.View.extend({

    className: 'modal',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.router.spin.start();
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .modal-cancel': function (e) {
        $.fancybox.close();
      },
      'click li': function (e) {
        $.fancybox.close();
      },
    },

    setup: function () {

      // Get meta tags.
      var path = this.options.pathname || window.location.pathname;
      rest.get(path + '?static=true', _.bind(function (err, body) {
        if (err) {
          return console.log(err);
        }

        var rx = /(<meta.*?>)/g;
        var metas = [];
        var match;
        while (match = rx.exec(body)) {
          metas.push(match[1]);
        }
        var head = $('head');
        $('meta', head).remove();
        for (var i = metas.length - 1; i >= 0; --i) {
          $(metas[i]).prependTo(head);
        }

        // Dump content into modal.
        $.fancybox(this.$el, {
          openEffect: 'fade',
          closeEffect: 'fade',
          closeBtn: false,
          padding: 0
        });

        var url = $('meta[property="og:url"]').attr('content');
        this.share = new Share('.share-button', {
          url: url,
          // title:
          // description:
          // image:
          ui: {
            flyout: 'top right',
            button_font: false,
            button_text: '',
            // icon_font:
          },
          networks: {
            google_plus: {
              enabled: true,
              // url:
              before: function () {
                this.url = url;
              }
            },
            twitter: {
              enabled: true,
              // url:
              // description:
              before: function () {
                var desc = $('meta[name="twitter:description"]')
                    .attr('content');
                this.description = encodeURIComponent(desc);
              }
            },
            facebook: {
              enabled: true,
              load_sdk: false,
              // url: 
              app_id: this.app.facebook.clientId,
              // title:
              // caption:
              // description:
              // image:
            },
            pinterest: {
              enabled: false,
              // url:
              // image:
              // description:
            },
            email: {
              enabled: true,
              // title:
              // description:
              before: function () {
                var desc = url + '\n\n' + $('meta[property="og:description"]')
                    .attr('content');
                this.description = encodeURIComponent(desc);
              }
            }
          }
        });

        this.share.open();
        this.app.router.spin.stop();
      }, this));

      return this;
    },

    destroy: function () {
      $.fancybox.close();
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
    }

  });
});
