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
  'text!../../templates/shipping.cart.html',
  'text!../../templates/shipping.address.html',
  'text!../../templates/shipping.options.html',
  'text!../../templates/shipping.summary.html',
  'text!../../templates/shipping.processing.html',
  'views/lists/events',
  'views/lists/ticks'
], function ($, _, Backbone, mps, rest, util, Spin, template, title,
      shippingCartTemp, shippingAddressTemp, shippingOptionsTemp,
      shippingSummaryTemp, shippingProcessingTemp, Events, Ticks) {

  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [
        mps.subscribe('cart/checkout', _.bind(this.checkout, this)),
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

    renderModal: function (template, opts) {
      opts = opts || {};
      opts.member = this.app.profile.member;

      $.fancybox(_.template(template)(opts), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0,
        modal: true
      });
    },

    closeModal: function () {
      $.fancybox.close();
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

      this.stripeHandler = StripeCheckout.configure({
        key: this.app.stripe.key,
        billingAddress: false
      });

      var fancyOpts = {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        nextClick: true,
        padding: 0
      };

      this.$('a.fancybox').fancybox(fancyOpts);

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

    addToCart: function (e) {
      var button = $(e.target).closest('.add-to-cart');
      var picker = button.parent();
      var sku = picker.data('sku');

      var product = _.find(this.app.profile.content.products.items,
          function (i) {
        return i.sku === sku;
      });
      if (!product) {
        return;
      }

      var cart = store.get('cart') || {};
      var cnt = (cart[sku] || 0) + 1;
      if (cnt > this.app.MAX_PRODUCT_QUANTITY_PER_ORDER) {
        return mps.publish('flash/new', [{
          message: 'Maximum quantity per order reached.',
          level: 'alert',
          type: 'popup'
        }]);
      }
      cart[sku] = cnt;

      store.set('cart', cart);
      mps.publish('cart/update');

      mps.publish('flash/new', [{
        message: product.title + ' added to cart (' + cart[sku] + ' total).',
        level: 'alert',
        type: 'popup'
      }]);
    },

    checkout: function (e) {
      var summary = this.getOrderSummary();

      if (summary.count <= 0) {
        return;
      }

      this.renderModal(shippingCartTemp, {
        summary: summary,
        max: this.app.MAX_PRODUCT_QUANTITY_PER_ORDER
      });

      var cancel = $('.modal-cancel');
      var confirm = $('.modal-confirm');
      
      cancel.click(_.bind(this.closeModal, this));

      confirm.click(_.bind(function (e) {
        this.closeModal();
        this.getShippingOptions();
      }, this));

      $('input[name$="-qnty"]').bind('change', _.bind(function (e) {
        var input = $(e.target);
        var cnt = Math.min(parseInt(input.val(), 10),
            this.app.MAX_PRODUCT_QUANTITY_PER_ORDER);
        var sku = input.data('sku');

        var cart = store.get('cart') || {};
        cart[sku] = cnt;

        store.set('cart', cart);
        mps.publish('cart/update');

        this.closeModal();
        this.checkout();

        $('input[name="' + sku + '-qnty"]').focus();

      }, this));

      return false;
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

    getShippingOptions: function (buyNow) {
      var cart = buyNow ? store.get('buyNow'): store.get('cart');

      if (_.isEmpty(cart)) {
        return false;
      }

      var address;
      var saveAddress;
      var isValid = false;

      this.clearOrder();

      this.renderModal(shippingAddressTemp, {
        back: !buyNow
      });

      var cancel = $('.modal-cancel');
      var back = $('.modal-back');
      var confirm = $('.modal-confirm');

      var spinner = new Spin($('.modal .button-spin'), {
        color: '#808080',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      cancel.click(_.bind(this.closeOrder, this));

      back.click(_.bind(function (e) {
        this.closeModal();
        this.checkout();
      }, this));

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
          cart: cart,
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
          
          this.closeModal();
          this.chooseShippingOption(buyNow);
        }, this));
      }, this));

      var form = $('.shipping-address-form');
      var inputs = $('.shipping-form input[type="text"]');
      var saveAddressBox = $('.modal-options input[name="saveAddress"]');

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

      inputs.bind('keyup', function (e) { _getAddress(); })
          .bind('change', function (e) { _getAddress(); });
      _getAddress();

      return false;
    },

    chooseShippingOption: function (buyNow) {
      var cart = buyNow ? store.get('buyNow'): store.get('cart');
      var shipTo = store.get('shipTo');
      var shippingOptions = store.get('shippingOptions');
      var shipping = store.get('shipping');

      if (_.isEmpty(cart) || !shipTo || !shippingOptions) {
        return false;
      }

      this.renderModal(shippingOptionsTemp, {
        options: shippingOptions,
        shipping: shipping
      });

      var cancel = $('.modal-cancel');
      var back = $('.modal-back');
      var confirm = $('.modal-confirm');
      
      cancel.click(_.bind(this.closeOrder, this));

      back.click(_.bind(function (e) {
        this.closeModal();
        this.getShippingOptions(buyNow);
      }, this));

      confirm.click(_.bind(function (e) {
        var optionCode =
            $('.shipping-options-form input:radio[name="option"]:checked')
            .val();
        var shipping = _.find(shippingOptions, function (o) {
          return o.serviceLevelCode === optionCode;
        });
        shipping.shipTo = shipTo;
        store.set('shipping', shipping);

        this.closeModal();
        this.confirmShippingSummary(buyNow);
      }, this));

      $('.modal-body tr').click(function (e) {
        var tr = $(e.target).closest('tr');
        var option = $('input[name="option"]', tr);
        option.attr('checked', 'checked');
      });

      return false;
    },

    getOrderSummary: function (buyNow, demandShipping) {
      var cart = buyNow ? store.get('buyNow'): store.get('cart');
      var shipping = store.get('shipping');

      if (_.isEmpty(cart)) {
        return false;
      }

      if (demandShipping && (!shipping || !shipping.shipTo)) {
        return false;
      }

      var items = {};
      var shipment = demandShipping ? shipping.shipments[0] : null;
      var shippingAndHandlingCost = shipment ? shipment.cost.amount : 0;
      var total = 0;
      var count = 0;

      _.each(cart, _.bind(function (quantity, sku) {
        var product = _.find(this.app.profile.content.products.items,
            function (i) {
          return i.sku === sku;
        });
        if (!product) {
          return;
        }
        var cost = quantity * product.price;
        items[sku] = {product: product, quantity: quantity, cost: cost};
        total += cost;
        count += quantity;
      }, this));
      
      var itemsTotal = total;
      total += shippingAndHandlingCost * 100;

      var shippingAndHandling;
      if (demandShipping) {
        shippingAndHandling = shipping.serviceLevelName + ' (' +
            shipment.carrier.description + ')<br />';
        shippingAndHandling += 'Ships ' +  new Date(shipment.expectedShipDate)
            .format('ddd, mmm d, h:MMtt Z') + '<br />';
        shippingAndHandling += 'Delivered by ' +
            new Date(shipment.expectedDeliveryMaxDate)
            .format('ddd, mmm d, h:MMtt Z');
      }

      return {
        cart: cart,
        shipping: shipping,
        count: count,
        items: items,
        shippingAndHandling: shippingAndHandling,
        shippingAndHandlingCost: shippingAndHandlingCost,
        itemsTotal: itemsTotal,
        total: total
      };
    },

    confirmShippingSummary: function (buyNow) {
      var summary = this.getOrderSummary(buyNow, true);

      this.renderModal(shippingSummaryTemp, {
        summary: summary
      });

      var cancel = $('.modal-cancel');
      var back = $('.modal-back');
      var confirm = $('.modal-confirm');
      
      cancel.click(_.bind(this.closeOrder, this));

      back.click(_.bind(function (e) {
        this.closeModal();
        this.chooseShippingOption(buyNow);
      }, this));

      confirm.click(_.bind(function (e) {
        this.closeModal();
        this.collectPayment(summary, buyNow);
      }, this));

      return false;
    },

    collectPayment: function (summary, buyNow) {
      var itemsDescription = summary.count + ' item';
      if (summary.count !== 1) {
        itemsDescription += 's';
      }
      itemsDescription += ': $' + (summary.itemsTotal / 100).toFixed(2) +
          ' (USD)';

      var shippingDescription = 'Shipping & Handling: $' +
          summary.shippingAndHandlingCost.toFixed(2) + ' (USD)';

      this.stripeHandler.open({
        name: itemsDescription,
        description: shippingDescription,
        amount: summary.total,
        image: this.app.images.store_avatar,
        token: _.bind(function (token) {
          var order = {
            token: token,
            cart: summary.cart,
            shipping: summary.shipping,
            description: itemsDescription
          };
          this.placeOrder(order);
        }, this)
      });
    },

    placeOrder: function (order) {
      // Give 'em a random processing GIF.
      rest.get('http://api.giphy.com/v1/gifs/random?api_key=' +
          'dc6zaTOxFJmzC&tag=processing', _.bind(function (err, res) {
        loadingGIF = err ? null: res.data;

        this.renderModal(shippingProcessingTemp, {
          loadingGIF: loadingGIF
        });

        rest.post('/api/store/checkout', order, _.bind(function (err, data) {
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

          this.emptyCart();
          mps.publish('cart/update');
          this.closeOrder();

          mps.publish('flash/new', [{
            message: data.message,
            level: 'alert',
            type: 'block',
            sticky: true
          }, true]);
        }, this));
      }, this));

      return false;
    },

    emptyCart: function () {
      store.set('cart', {});
      store.set('buyNow', {});
    },

    clearOrder: function () {
      store.set('shippingOptions', null);
      store.set('shipTo', null);
      store.set('shipping', null);
      store.set('summary', null);
    },

    closeOrder: function () {
      this.clearOrder();
      this.closeModal();
    }

  });
});
