/*
 * Page view for films.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/store.html',
  'text!../../templates/store.title.html',
  'text!../../templates/shipping.address.html',
  'text!../../templates/shipping.options.html',
  'views/lists/events',
  'views/lists/ticks'
], function ($, _, Backbone, mps, rest, util, Spin, template, title,
      shippingAddress, shippingOptions, Events, Ticks) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [
        mps.subscribe('cart/checkout', _.bind(this.getShippingOptions, this)),
        mps.subscribe('cart/empty', _.bind(this.emptyCart, this))
      ];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | Store');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.title = _.template(title).call(this);

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .add-to-cart': 'addToCart',
      'click .buy-now': 'buyNow',
      'click .navigate': 'navigate'
    },

    setup: function () {
      _.defer(function () {
        mps.publish('cart/update');
      });

      this.feed = new Events(this.app, {parentView: this,
          reverse: true, filters: false});
      this.boulders = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'b', heading: 'Boulders'});
      this.routes = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'r', heading: 'Routes'});

      this.stripeHandler = StripeCheckout.configure({
        key: this.app.stripe.key,
        billingAddress: false
      });

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
      this.feed.destroy();
      this.boulders.destroy();
      this.routes.destroy();
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

    buyNow: function (e) {
      var button = $(e.target).closest('.buy-now');
      var picker = button.parent();
      var sku = picker.data('sku');
      var buyNow = {};
      buyNow[sku] = 1;
      store.set('buyNow', buyNow);

      this.getShippingOptions(true);
    },

    addToCart: function (e) {
      var button = $(e.target).closest('.add-to-cart');
      var picker = button.parent();
      var sku = picker.data('sku');

      var cart = store.get('cart') || {};
      cart[sku] = (cart[sku] || 0) + 1;
      store.set('cart', cart);
      mps.publish('cart/update');
    },

    getShippingOptions: function (buyNow) {
      var address;
      var saveAddress;
      var isValid = false;

      $.fancybox(_.template(shippingAddress)({
        member: this.app.profile.member
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      var confirm = $('.modal-confirm');
      var cancel = $('.modal-cancel');
      var spinner = new Spin($('.modal .button-spin'), {
        color: '#808080',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      cancel.click(function (e) {
        $.fancybox.close();
      });

      confirm.click(_.bind(function (e) {
        if (!isValid) {
          return false;
        }

        spinner.start();
        confirm.addClass('spinning').attr('disabled', true);

        var username = this.app.profile.member ?
            this.app.profile.member.username: false;
        if (saveAddress && username) {
          rest.put('/api/members/' + username, {
            address: address
          }, _.bind(function (err, data) {
            if (err) {
              mps.publish('flash/new', [{
                err: err,
                level: 'error',
                type: 'popup',
                sticky: true
              }]);
              return false;
            }
            this.app.profile.member.address = address;
          }, this));
        }

        // Get shipping options for sending the cart items to this address.
        var payload = {
          cart: buyNow ? store.get('buyNow'): store.get('cart') || {},
          address: address
        };
        rest.post('/api/store/shipping', payload, _.bind(function (err, data) {
          spinner.stop();
          confirm.removeClass('spinning').attr('disabled', false);

          if (err) {
            mps.publish('flash/new', [{
              err: err,
              level: 'error',
              type: 'popup',
              sticky: true
            }]);
            return false;
          }
          
          store.set('shippingOptions', data.options);
          store.set('shipTo', data.shipTo);
          
          $.fancybox.close();
          this.chooseShippingOption(buyNow);
        }, this));
      }, this));

      var form = $('.shipping-address-form');
      var inputs = $('.shipping-form input[type="text"]');
      var saveAddressBox = $('.modal-actions input[name="saveAddress"]');

      function _getAddress() {
        address = form.serializeObject();
        _.each(address, function (v, k) {
          if (v.trim() === '') {
            address[k] = false;
          }
        });
        if (!address.name || !address.address || !address.city ||
            !address.zip || !address.country) {
          confirm.addClass('disabled').attr('disabled', true);
          isValid = false;
          saveAddress = false;
        } else {
          confirm.removeClass('disabled').attr('disabled', false);
          isValid = true;
          saveAddress = saveAddressBox.is(':checked');
        }

        return isValid;
      }

      inputs.focus(function (e) {
        var el = $(e.target);
        el.parent().addClass('focus');
        var sib = el.parent().prev();
        if (sib.length > 0) {
          sib.addClass('sibling-focus-right');
        }
      });

      inputs.blur(function (e) {
        $('.shipping-form td').removeClass('sibling-focus-right');
        var el = $(e.target);
        el.parent().removeClass('focus');
      });

      inputs.bind('keyup', function (e) { _getAddress(); });
      _getAddress();

      return false;
    },

    chooseShippingOption: function (buyNow) {
      $.fancybox(_.template(shippingOptions)({
        member: this.app.profile.member,
        cart: buyNow ? store.get('buyNow'): store.get('cart'),
        address: store.get('address'),
        options: store.get('shippingOptions')
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      var confirm = $('.modal-confirm');
      var cancel = $('.modal-cancel');
      
      cancel.click(function (e) {
        $.fancybox.close();
      });
      confirm.click(_.bind(function (e) {
        var optionCode =
            $('.shipping-options-form input:radio[name="option"]:checked')
            .val();
        var shipping = _.find(store.get('shippingOptions'), function (o) {
          return o.serviceLevelCode === optionCode;
        });
        shipping.shipTo = store.get('shipTo');
        store.set('shipping', shipping);

        $.fancybox.close();
        this.checkout(buyNow);

      }, this));

      $('.modal-body tr').click(function (e) {
        var tr = $(e.target).closest('tr');
        var option = $('input[name="option"]', tr);
        option.attr('checked', 'checked');
      });

      return false;
    },

    checkout: function (buyNow) {
      var cart = buyNow ? store.get('buyNow'): store.get('cart');
      var shipping = store.get('shipping');

      var count = 0;
      var total = 0;
      _.each(cart, _.bind(function (quantity, sku) {
        var product = _.find(this.app.profile.content.products.items,
            function (i) {
          return i.sku === sku;
        });
        if (!product) {
          return;
        }
        var cost = quantity * product.price;
        total += cost;
        count += quantity;
      }, this));
      var name = count + ' item';
      if (count !== 1) {
        name += 's';
      }
      name += ': $' + (total / 100).toFixed(2);

      var shippingAndHandling = shipping.shipments[0].cost.amount * 100;
      total += shippingAndHandling;
      var description = 'Shipping & handling: $' +
          (shippingAndHandling / 100).toFixed(2);

      this.stripeHandler.open({
        name: name,
        description: description,
        amount: total,
        image: this.app.images.store_avatar,
        token: function (token) {
          var payload = {
            token: token,
            cart: cart,
            shipping: shipping,
            description: [name, description].join(', ')
          };
          rest.post('/api/store/checkout', payload, function (err, data) {
            if (err) {
              var errOpts = {level: 'error', type: 'popup', sticky: true};
              if (err.message === 'OVER_MAX_PRODUCT_QUANTITY_PER_ORDER' ||
                  err.message === 'INSUFFICIENT_STOCK') {
                _.each(err.data, function (p) {
                  var message = err.message + ': ' + p.name + ' (';
                  if (p.allowed !== undefined) {
                    message += 'please limit your order to ' + p.allowed;
                  }
                  if (p.good !== undefined) {
                    message += p.good + ' remaining';
                  }
                  message += ')';
                  errOpts.err = {message: message};
                  mps.publish('flash/new', [errOpts, true]);
                });
              } else {
                errOpts.err = err;
                mps.publish('flash/new', [errOpts, true]);
              }

              return false;
            }
            
            mps.publish('flash/new', [{
              message: data.message,
              level: 'alert',
              type: 'popup',
              sticky: true
            }, true]);
          });
        }
      });
    },

    emptyCart: function () {
      store.set('cart', {});
    }

  });
});
