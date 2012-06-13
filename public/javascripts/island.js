/*!
 * Island.IO
 * v 0.1
 * Copyright(c) 2012 Sander Pick <sanderpick@gmail.com>
 */

// Polyfills

(function() {
  var lastTime = 0;
  var vendors = ['ms', 'moz', 'webkit', 'o'];
  for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame = 
      window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
        timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

  if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
}());


Island = (function ($) {

  /**
   * island color scheme
   */

  var colors = {
    green: '#b1dc36',
    orange: '#d04c38',
    blue: '#4bb8d7',
    pink: '#d12b83',

    lightgreen: '#eff8d7',
    lightorange: '#f6dbd7',

    black: '#1a1a1a',
    darkgray: '#404040',
    gray: '#808080',
    lightgray: '#b3b3b3',

    bordergray: '#cdcdcd',
    backgray: '#fcfcfb',
    mattegray: '#f2f2f2',
  };

  var signinSpinOpts = {
    lines: 17,
    length: 0,
    width: 3,
    radius: 40,
    rotate: 0,
    color: '#000',
    speed: 2.2,
    trail: 100,
    shadow: false,
    hwaccel: false,
    className: 'spinner',
    zIndex: 2e9,
    top: 'auto',
    left: 'auto'
  };

  var searchSpinOpts = {
    lines: 13,
    length: 0,
    width: 2,
    radius: 10,
    rotate: 0,
    color: '#000',
    speed: 2.2,
    trail: 60,
    shadow: false,
    hwaccel: false,
    className: 'spinner',
    zIndex: 2e9,
    top: 'auto',
    left: 'auto'
  };

  var uploadSpinOpts = {
    lines: 17,
    length: 0,
    width: 2,
    radius: 20,
    rotate: 0,
    color: '#000',
    speed: 2.2,
    trail: 60,
    shadow: false,
    hwaccel: false,
    className: 'spinner',
    zIndex: 2e9,
    top: 'auto',
    left: 'auto'
  };

  var Spin = function (el) {
    if (el.length === 0) return;
    var spinTarget = el.get(0);
    var opts;
    if (el.hasClass('signin-spinner'))
      opts = signinSpinOpts;
    else if (el.hasClass('search-spinner'))
      opts = searchSpinOpts;
    else if (el.hasClass('upload-spinner'))
      opts = uploadSpinOpts;
    var spinner = new Spinner(opts).spin(spinTarget).stop();
    return {
      start: function () { spinner.spin(spinTarget); },
      stop: function () { spinner.stop(); }
    };
  }

  /**
   * logo pulse
   */

  var pulseCnt = 0;

  function pulse (a, b) {
    if (pulseCnt % 2 == 0)
      $(b).fadeTo(500, 0.75);
    else 
      $(b).fadeTo(500, 1);
    pulseCnt += 1;
  }

  function cancelPulse() {
    clearInterval(pulseTimer);
    clearTimeout(pulseCancel);
    $("#logo-a").show();
    $("#logo-b").hide();
  }

  /**
   * tweets
   */

  var twitters = [];
  var tweets = [];
  var twot = 0;
  var twut = 0;
  var twap;
    
  function twit() {
    twap.hide().html(tweets[twut]);
    twap.fadeIn('fast');
    twut++;
    if (twut == tweets.length) 
      twut = 0;
  }

  function twat(t) {
    tweets = tweets.concat(t);
    twot++;
    if (twot == twitters.length) {
      $.fisherYates(tweets);
      var tweeter = $.setIntervalObj(this, 5000, twit);
      twit();
    }
  };

  function updateTimes() {
    $('.comment-added, .object-added').each(function (i) {
      var time = $(this);
      if (!time.data('ts'))
        time.data('ts', time.text());
      time.text(Util.getRelativeTime(time.data('ts')));
    });
  }


  /**
   * select hearts for rating
   */

  var selectHearts = function (hearts, x, h) {
    if (!h && h !== 0) {
      if (x < 10) h = 0;
      else if (x < 30) h = 1;
      else if (x < 55) h = 2;
      else if (x < 80) h = 3;
      else if (x < 105) h = 4;
      else h = 5;
    }
    $(hearts.children()).hide();
    for (var i=0; i < h; i++)
      $(hearts.children()[i]).show();
    return h;
  }

  /**
   * search media
   */

  function search(query, fn) {
    jrid.empty();
    $.get('/search/' + query, fn);
  }

  /**
   * simulate gifs for videos in grid
   */

  function initVideoSlides() {
    $('.is-video').each(function (v) {
      if ($(this).data().timer) return;
      var thumbs = $('.thumb', this);
      var num = thumbs.length, i = 1;
      var timer = setInterval(function () {
        var h = i === 0 ? num - 1 : i - 1;
        $(thumbs[h]).hide();
        $(thumbs[i]).show();
        i += i == num - 1 ? 1 - num : 1;
      }, 2000);
      $(this).data({ timer: timer });
    });
  }

  /**
   * trending media
   */

  var trending;
  function Trending(el) {
    var req;
    var last;
    var delay = 20;
    var inc = 1;
    var holder;
    var holderOff;
    var holderHeight;
    var top = 0;
    var newKids = [];
    var offsets = [];
    var animate = true;
    var nextIndex = null;
    return {
      init: function () {
        holder = $(el);
        if (holder.length === 0) return;
        holderOff = holder.offset().top;
        this.start();
      },
      start: function () {
        holderHeight = holder.height();
        $(holder.children()[0]).clone().appendTo(holder);
        offsets = _.map(holder.children(), function (child) {
            return $('img', child).offset().top - holderOff; });
        req = requestAnimationFrame(_.bind(this.scroll, this));
      },
      update: function () {
        cancelAnimationFrame(req);
        this.start();
      },
      scroll: function (time) {
        var _this = this;
        if (!last || time - last > delay) {
          last = Date.now();
          top -= inc;
          if (-top >= holderHeight) {
            top = 0;
            holder.css({ marginTop: top });
            if (newKids.length !== 0) {
              holder.empty();
              for (var i = 0; i < newKids.length; ++i)
                newKids[i].appendTo(holder);
              this.update();
            }
          } else holder.css({ marginTop: top });

          var tmp = nextIndex;
          var next = _.find(offsets, function (off, i) {
            tmp = i;
            return (-top - off) < 0;
          });
          if (tmp !== nextIndex) {
            nextIndex = tmp;
            animate = true;
          }
          if (animate && nextIndex !== null
              && nextIndex !== 0 && offsets[nextIndex - 1]
              + ((next - offsets[nextIndex - 1]) / 2) < -top) {
            animate = false;
            cancelAnimationFrame(req);
            holder.animate({ marginTop: -next + 'px' }, 200,
                          'easeOutExpo', function () {
              top = -next;
              req = requestAnimationFrame(_.bind(_this.scroll, _this));
            });
          } else
            req = requestAnimationFrame(_.bind(_this.scroll, _this));
        } else
          req = requestAnimationFrame(_.bind(_this.scroll, _this));
      },
      receive: function (trends) {
        newKids = [];
        for (var i=0; i < trends.length; i++)
          newKids.push($(trends[i]));
      },
    };
  }

  /**
   * media grid
   */

  var grid;
  var jrid;
  var gridHeight;
  var gridWrap;
  function Grid(el) {
    // grid vars
    var wrap = $(el);
    var NUM_GRID = 50;
    var NUM_FLOW = 25;
    var GRID_OBJ_FREQ = { '482px': 1, '231px': '*' };
    var COL_WIDTH = 231;
    var COL_GAP_X = 20;
    var COL_GAP_Y = 40;
    var MIN_COLS = 2;
    var MAX_COLS = 4;
    var SIN_COLS = 2;
    var x_off = 0;
    var y_off = 0;
    var col_heights = [];

    // determine the number of columns
    function num_cols() {
      return Math.min(Math.max(MIN_COLS, (parseInt(wrap.innerWidth())
                      + COL_GAP_X) / (COL_WIDTH + COL_GAP_X)), MAX_COLS);
    }

    return {
      collage: function (single, extra) {

        // calc num cols once
        var nc = num_cols();

        // clear column height array
        for (var x = 0; x < nc; x++) 
          col_heights[x] = 0;

        if (single && comsOffset() > jrid.offset().top) {
          extra = extra || 0;
          col_heights[2] = col_heights[3] = comsOffset() - wrap.offset().top + 10 + extra;
        }

        // loop over each object in grid
        $('.each-grid-obj').each(function (i) {

          var self = $(this);
          var obj_col = 0;
          var obj_y = 0;
            
          // determine how many columns the object will span
          var obj_span = Math.max(Math.round(self.outerWidth() / COL_WIDTH), 1);

          // determine which column to place the object in
          for (var x = 0; x < nc - (obj_span - 1); x++)
            obj_col = col_heights[x] < col_heights[obj_col] ? x : obj_col;

          // determine the object's y position
          for (x = 0; x < obj_span; x++) 
            obj_y = Math.max(obj_y, col_heights[obj_col + x]);

          // determine the new height for the effected columns
          for (x = 0; x < obj_span; x++) 
            col_heights[obj_col + x] = parseInt(self.outerHeight()) + COL_GAP_Y + obj_y;

          // set the object's css position
          self.css('left', obj_col * (COL_WIDTH + COL_GAP_X) + x_off).css('top', obj_y + y_off).show();
        });

        // get max column height
        gridHeight = Math.max.apply(null, col_heights);

        // add some extra space below the grid
        wrap.height(gridHeight + 100);
      }
    }
  }

  /**
   * adjust grid wrapper window stays put
   */

  function adjustGridHeight() {
    gridWrap.css({ height: $('#search').height() + gridHeight });
  }

  /**
   * determine comments vertical space
   */

  function comsOffset() {
    var coms = $('#recent-comments').length > 0 ?
              $('#recent-comments') : $('.obj-comments');
    return coms.length > 0 ? coms.offset().top + coms.height() + 20 : 0;
  }

  /**
   * re-collage if overlapping
   */

  var comsSpace;
  function checkComsSpace() {
    if (comsOffset() != comsSpace)
      grid.collage(true);
  }

  /**
   * utils
   */

  function hideFlashMessages () {
    $(this).fadeOut();
  };


  return {
    
    /**
     * setup doc
     */

    go: function () {

      /////////////////////////// UTILS

      // extras
      String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g,""); };
      String.prototype.ltrim = function() { return this.replace(/^\s+/,""); };
      String.prototype.rtrim = function() { return this.replace(/\s+$/,""); };

      // scope aware timeouts
      // TODO: replace with native
      $.setTimeoutObj = function (o, t, f, a) {
        return setTimeout(function () { f.apply(o, a); }, t);
      };
      $.setIntervalObj = function (o, t, f, a) {
        return setInterval(function () { f.apply(o, a); }, t); 
      };

      // random generation
      $.fisherYates = function (a) {
        var i = a.length;
        if (i==0 ) return false;
        while (--i) {
          var j = Math.floor(Math.random() * (i + 1));
          var tempi = a[i];
          var tempj = a[j];
          a[i] = tempj;
          a[j] = tempi;
        }
      };

      // determine of object is empty (non-enumerable)
      $.isEmpty = function (o) {
        for (var p in o)
          if (o.hasOwnProperty(p))
            return false;
        return true;
      };

      // server PUT
      $.put = function (url, data, cb) {
        if ('function' === typeof data) {
          cb = data;
          data = {};
        }
        data._method = 'PUT';
        $.post(url, data, cb, 'json');
      };

      // map form data to JSON
      $.fn.serializeObject = function () {
        var o = {};
        var a = this.serializeArray();
        $.each(a, function () {
          if (o[this.name]) {
            if (!o[this.name].push)
              o[this.name] = [o[this.name]];
            o[this.name].push(this.value.trim() || '');
          } else
            o[this.name] = this.value.trim() || '';
        });
        return o;
      };

      // get database ID
      $.fn.itemID = function () {
        try {
          var items = $(this).attr('id').split('-');
          return items[items.length - 1];
        } catch (exception) {
          return null;
        }
      };

      // size notifications
      ui.Notification.prototype.fit = function () {
        var w = (($(window).width() - 984) / 2) - 26;
        $('.notification').css({ minWidth: w, maxWidth: w });
        return this;
      }


      /////////////////////////// SETUP

      // init trending
      trending = new Trending('#trend');
      trending.init();

      // get relative comment times
      $.setIntervalObj(this, 5000, updateTimes); updateTimes();

      // init media grid
      grid = new Grid('#grid');
      jrid = $('#grid');
      gridWrap = $('.grid-wrap');
      if (jrid.hasClass('adjustable-grid')) {
        comsSpace = comsOffset();
        var upper = $('.trending-media-wrap').length > 0 ? $('.trending-media-wrap') : $('.single-left');
        gridWrap.css({ top: upper.offset().top + upper.height() + 40 });
        grid.collage(true);
      } else grid.collage();

      // TODO: better way to do this?
      // mobile checks
      if (navigator.userAgent.match(/Android/i) ||
       navigator.userAgent.match(/webOS/i) ||
       navigator.userAgent.match(/iPhone/i) ||
       navigator.userAgent.match(/iPod/i)
      ) {

        // hide footer
        $('#footer').hide();

      }

      // Clear the shit that come back from Facebook
      if (window.location.hash !== '') {
        try {
          window.history.replaceState('', '', window.location.pathname + window.location.search);
        } catch(err) {}
      }

      $('.jp-jplayer').each(function (i) {
        $('#' + $(this).attr('id')).jPlayer({
          ready: function (event) {
            $(this).jPlayer('setMedia', {
              mp3: $(this).data('src'),
            });
          },
          play: function () {
            $(this).jPlayer('pauseOthers');
          },
          swfPath: 'https://d271mvlc6gc7bl.cloudfront.net/main/jplayer/js',
          wmode: 'window',
          cssSelectorAncestor: '#jp_container_' + (i + 1),
        });
      });

      $('video').each(function () {
        jwplayer($(this).attr('id')).setup({
          flashplayer: 'https://d271mvlc6gc7bl.cloudfront.net/main/jwplayer/player.swf',
          skin: 'https://d271mvlc6gc7bl.cloudfront.net/main/jwplayer/skins/bekle.zip',
        });
      });

      // start all video thumb timers
      initVideoSlides();

      // tweets
      twitterNames = $('#twitter-names').text().split(',');
      for (var i=0; i < twitterNames.length; i++)
        if (twitterNames[i] != 'undefined' && twitterNames[i] != '')
          twitters.push(twitterNames[i]);
      twap = $('#twitter');
      for (var tt in twitters)
        $.tweet({
          username: twitters[tt],
          callback: twat,
        });

      // Fit the sign in page background
      var bg = $('.signin-bg > img');
      function fitSignInBG () {
        if (bg.length === 0) return;
        var win = $(this);
        var aspect = bg.width() / bg.height();
        bg.width(win.width());
        bg.height(win.width() / aspect);
      }
      if (bg.length > 0) { $(window).resize(fitSignInBG); fitSignInBG(); }

      // Create the spinner
      var signinSpin = new Spin($('.signin-spinner'));
      var searchSpin = new Spin($('.search-spinner'));
      var uploadSpin = new Spin($('.upload-spinner'));

      // Handle pagination
      var pageQuery = Util.getQueryVariable('p');
      var page = pageQuery && pageQuery !== '' ?
                    Number(pageQuery) : 1;
      if ($('#grid').length !== 0) {
        var doc = $(document);
        var win = $(window);
        var fetching = false;
        var abort = false;
        var paginate = _.throttle(function (e) {
          var pos = doc.height()
                    - win.height()
                    - doc.scrollTop();
          if (!fetching && !abort && pos < 100
              && !jrid.hasClass('search-results')) {
            fetching = true;
            $.post('/page/' + (page + 1), function (res) {
              if ('success' === res.status) {
                if (res.data.results.length === 0) {
                  abort = true;
                  return;
                }
                ++page;
                for (var i = 0; i < res.data.results.length; ++i)
                  $(res.data.results[i]).appendTo(jrid);
                if (jrid.hasClass('adjustable-grid'))
                  grid.collage(true);
                else grid.collage();
                updateTimes();
                initVideoSlides();
                // window.history.replaceState({}, '',
                //     window.location.pathname + '?p=' + page);
              } else console.log(res.message);
              fetching = false;
            }, 'json');
          }
        }, 100);
        win.scroll(paginate).resize(paginate);
      }

      
      /////////////////////////// ACTIONS

      // forms
      $('form input[type="text"], form input[type="password"], form textarea')
          .bind('focus', function () {
        if ($(this).hasClass('is-input-alert'))
          $(this).removeClass('is-input-alert');
      });

      // landing page login - register
      var loginForm = $('#login-form');
      var registerForm = $('#register-form');
      var gotoLoginButton = $('#goto-login-form');
      var gotoRegisterButton = $('#goto-register-form');

      // login member
      var loginButton = $('#login');
      var loginEmail = $('input[name="username"]');
      var loginPassword = $('input[name="password"]');

      // register member
      var registerButton = $('#add-member');
      var registerName = $('input[name="newname"]');
      var registerEmail = $('input[name="newusername"]');
      var registerPassword = $('input[name="newpassword"]');

      // switch between forms
      function gotoLogin() {
        registerForm.animate({
          opacity: [0, 'easeOutExpo'],
          left: ['+=300', 'linear']
        }, 200, 'easeOutExpo', function () {
          registerForm.hide();
          registerForm.css({ opacity: 1, left: 0 });
          loginForm.fadeIn('fast');
          loginEmail.focus();
        });
        gotoLoginButton.hide();
        gotoRegisterButton.show();
      }
      function gotoRegister() {
        loginForm.animate({
          opacity: [0, 'easeOutExpo'],
          left: ['-=300', 'linear']
        }, 200, function () {
          loginForm.hide();
          loginForm.css({ opacity: 1, left: 0 });
          registerForm.fadeIn('fast');
          registerName.focus();
        });
        gotoRegisterButton.hide();
        gotoLoginButton.show();
      }

      // form control
      function exitLoginButton() {
        loginButton.removeClass('is-button-alert');
        resetLoginStyles();
      }
      function resetLoginStyles() {
        loginEmail.removeClass('is-input-alert');
        loginPassword.removeClass('is-input-alert');
      }
      function exitRegisterButton() {
        registerButton.removeClass('is-button-alert');
        resetRegisterStyles();
      }
      function resetRegisterStyles() {
        registerName.removeClass('is-input-alert');
        registerEmail.removeClass('is-input-alert');
        registerPassword.removeClass('is-input-alert');
      }

      function showSpinner() {
        $('.signin-strategies').hide();
        $('.signin-controls').hide();
        $('.signin-forms').hide();
        $('.signin-almost-there').hide();
        $('.signin-spinner').show();
      }
      function hideSpinner() {
        $('.signin-strategies').show();
        $('.signin-controls').show();
        $('.signin-forms').show();
        $('.signin-almost-there').show();
        $('.signin-spinner').hide();
      }

      $('a', gotoRegisterButton).bind('click',
          function () { gotoRegister(); });
      $('a', gotoLoginButton).bind('click',
          function () { gotoLogin(); });
      loginEmail.focus();

      loginButton.bind('mouseenter', function () {
        var email = loginEmail.val().trim();
        var password = loginPassword.val().trim();
        if (email !== '' && password !== '') {
          resetLoginStyles();
        } else {
          loginButton.addClass('is-button-alert');
          if (email == '') 
            loginEmail.addClass('is-input-alert');
          if (password == '') 
            loginPassword.addClass('is-input-alert');
        }
      }).bind('mouseleave', exitLoginButton);

      loginButton.bind('click', function (e) {
        e.preventDefault();
        signinSpin.start();
        showSpinner();
        var data = loginForm.serializeObject();
        $.post('/login', data, function (serv) {
          if ('success' === serv.status) {
            window.location = serv.data.path;
          } else if ('fail' === serv.status) {
            hideSpinner();
            signinSpin.stop();
            ui.error(serv.data.message).closable().hide(80000).effect('fade').fit();
            switch (serv.data.code) {
              case 'MISSING_FIELD':
              case 'ACCOUNT_WAITING':
                var missing = serv.data.missing;
                for (var i=0; i < missing.length; ++i)
                  $('input[name="' + missing[i] + '"]').addClass('is-input-alert').val('');
                break;
              case 'BAD_AUTH':
                loginPassword.val('').focus();
                break;
              case 'NOT_CONFIRMED':
                break;
            }
          }
        }, 'json');
      });

      registerButton.bind('mouseenter', function () {
        var name = registerName.val().trim();
        var email = registerEmail.val().trim();
        var password = registerPassword.val().trim();
        if (name != '' && email != '' && password != '') {
          resetRegisterStyles();
        } else {
          registerButton.addClass('is-button-alert');
          if (name == '')
            registerName.addClass('is-input-alert');
          if (email == '')
            registerEmail.addClass('is-input-alert');
          if (password == '')
            registerPassword.addClass('is-input-alert');
        }
      }).bind('mouseleave', exitRegisterButton);

      registerButton.bind('click', function (e) {
        e.preventDefault();
        signinSpin.start();
        showSpinner();
        var data = registerForm.serializeObject();
        data.id = registerButton.data('id');
        $.put('/signup', data, function (serv) {
          if ('success' === serv.status) {
            window.location = serv.data.path;
          } else if ('fail' === serv.status) {
            hideSpinner();
            signinSpin.stop();
            ui.error(serv.data.message).closable().hide(8000).effect('fade').fit();
            switch (serv.data.code) {
              case 'MISSING_FIELD':
                var missing = serv.data.missing;
                for (var i=0; i < missing.length; ++i)
                  $('input[name="' + missing[i] + '"]').addClass('is-input-alert');
                break;
              case 'INVALID_EMAIL':
              case 'DUPLICATE_EMAIL':
                registerEmail.val('').addClass('is-input-alert');
                registerEmail.focus();
                break;
            }
          }
        });
      });
      
      // Hide everything when a strategy is clicked
      $('.from-login').click(function (e) {
        signinSpin.start();
        showSpinner();
      });
      $('.from-settings').click(function (e) {
        $('.signin-strategy-btn, .signin-strategy-btn-disabled').hide();
        signinSpin.start();
        $('.signin-spinner').show();
      });

      // resend confirmation email
      $('.resend-conf').live('click', function (e) {
        var id = $(this).itemID()
        $.post('/resendconf/' + id, { id: id }, function (serv) {
          if ('success' === serv.status)
            return ui.notify(serv.data.message)
                      .closable().hide(8000).effect('fade').fit();
          if ('error' === serv.status)
            ui.error(serv.data.message)
                      .closable().hide(8000).effect('fade').fit();
        }, 'json');
      });

      // pulse logo on mouseover
      var logoA = $('#logo-a');
      var logoB = $('#logo-b');
      var logos = [logoA, logoB];
      
      $('#header-left').bind('mouseover', function () {
        logoA.hide();
        logoB.show();
        pulse(logos[0], logos[1]);
        pulseTimer = $.setIntervalObj(this, 500, pulse, logos);
        pulseCancel = $.setTimeoutObj(this, 5000, cancelPulse);
      }).bind('mouseout', function () {
        cancelPulse();
      });


      // init autogrow text
      $('textarea').autogrow();

      // rollover each object
      // $('.each-grid-obj').live('mouseover', function () {
      //   $('.object-added', this).hide();
      //   $('.object-meta', this).show();
      // }).live('mouseout', function () {
      //   $('.object-added', this).show();
      //   $('.object-meta', this).hide();
      // });


      // search box
      var searchBox = $('#search-box');

      // HACK
      if (navigator.userAgent.indexOf('Firefox') !== -1)
        searchBox.css({ padding: '5px 10px' });

      searchBox.bind('keyup search', function (e) {
        searchSpin.start();
        var txt = $(this).val().trim().toLowerCase();
        jrid.empty();
        if ('' === txt)
          txt = '__clear__';
        search(txt, function (res) {
          if ('success' === res.status) {
            for (var i=0; i < res.data.results.length; i++)
              $(res.data.results[i]).appendTo(jrid);
            if (jrid.hasClass('adjustable-grid'))
              grid.collage(true);
            else grid.collage();
            updateTimes();
            initVideoSlides();
            if ('__clear__' === txt) {
              jrid.removeClass('search-results');
              page = 1;
            }
            else
              jrid.addClass('search-results');
          } else console.log(res.message);
          searchSpin.stop();
        });
      }).bind('focus', adjustGridHeight);

      if (searchBox.val() !== '') {
        jrid.addClass('search-results');
        searchBox.trigger('keyup');
      }

      $('.grid-obj, .trending, .object-title-parent').live('click', function (e) {
        e.preventDefault();
        var data = $(this).data();
        $.put('/hit/' + data.id, function (res) {
          if ('error' === res.status)
            return console.log(res.message);
          window.location = '/' + data.key;
        });
      });

      // comment input behavior
      $('.commentor-input-dummy').bind('focus', function () {
        $(this).hide();
        $(this.nextElementSibling).show();
        $(this.nextElementSibling.firstElementChild).focus();
        checkComsSpace();
      });
      $('.commentor-input').bind('blur', function () {
        if (this.value.trim() == '') {
          $(this.parentNode).hide();
          $(this).val('').css({ height: 32 });
          $(this.parentNode.previousElementSibling).show();
          checkComsSpace();
        }
      }).bind('keyup', checkComsSpace);

      // add comment on media
      $('.add-comment').bind('click', function () {
        var str = $(this.previousElementSibling).val();
        str = str.replace(/\<script\>/ig, '');
        str = str.replace(/\<\/script\>/ig, '');
        str = $('<div>').html(str).text().trim();
        if (str === '') return false;
        $(this.previousElementSibling).val('').css({ height: 32 });
        $(this.parentNode).hide();
        $(this.parentNode.previousElementSibling).show();
        var mediaId = $(this).itemID();
        $.put('/comment/' + mediaId,
              { body: str }, function (serv) {
          if ('error' === serv.status)
            return console.log(serv.message);
          if ('fail' === serv.status)
            ui.error(serv.data.message).closable().hide(12000).effect('fade').fit();
        });
      });

      // show like heart
      $('.obj-holder').bind('mouseenter', function () {
        $('.hearts', this).show();
      }).bind('mouseleave', function () {
        $('.hearts', this).hide();
      });

      // no dragging hearts
      $('.hearts-wrap img, .hearts-back img').bind('mousedown', function (e) {
        e.preventDefault();
      });

      // rate media with hearts
      $('.hearts').each(function () {
        var _this = $(this);
        var currentHearts = parseInt(_this.data('num'));
        var x = 0;
        var h = 0;
        var rater = $('.hearts-back', this);
        var hearts = $('.hearts-wrap', this);
        if (currentHearts > 0)
          selectHearts(hearts, null, currentHearts);
        rater.bind('mouseleave', function (e) {
          selectHearts(hearts, null, currentHearts);
        }).bind('mousemove', function (e) {
          x = e.pageX - rater.offset().left;
          h = selectHearts(hearts, x);
        }).bind('click', function (e) {
          currentHearts = h;
          var id = rater.itemID();
          $.put('/rate/' + id, { val: h }, function (res) {
            if ('error' === res.status)
              return console.log(res.message);
          });
        });
      });

      $('.obj-details[data-date]').each(function () {
        var _this = $(this);
        var date = new Date(_this.data('date'));
        var txt;
        switch (_this.data('type')) {
          case 'media':
            txt = 'Added ' + Util.toLocaleString(date, 'mmm d, yyyy');
            break;
          case 'profile':
            txt = 'Contributor since ' + Util.toLocaleString(date,'m/d/yy');
            break;
        }
        _this.text(txt);
      });

      $('.birthday').each(function () {
        var _this = $(this);
        _this.text(Util.getAge(_this.text()));
      });

      // edit profile
      var settingsForm = $('#settings-form');
      var settingsButton = $('#save-settings');
      var settingsButtonMask = $('#save-settings-mask');

      var settingsName = $('input[name="member[displayName]"]');
      var settingsUsername = $('input[name="member[username]"]');
      var settingsEmail = $('input[name="member[primaryEmail]"]');
      var settingsBanner = $('img.settings-banner');
      var settingsBannerFile = $('input[name="my_file"]');
      var settingsBannerData = $('input[name="member[assembly]"]');
      var settingsBannerLeft = $('input[name="member[bannerLeft]"]');
      var settingsBannerTop = $('input[name="member[bannerTop]"]');
      var settingsDescription = $('input[name="member[description]"]');
      var settingsLocation = $('input[name="member[location]"]');
      var settingsHometown = $('input[name="member[hometown]"]');
      var settingsBirthday = $('input[name="member[birthday]"]');
      var settingsGender = $('input[name="member[gender]"]');
      var settingsWebsite = $('input[name="member[website]"]');
      var settingsTwitter = $('input[name="member[twitter]"]');

      var settingsNameLabel = $('label[for="member[displayName]"]');
      var settingsUsernameLabel = $('label[for="member[username]"]');
      var settingsEmailLabel = $('label[for="member[primaryEmail]"]');
      var settingsBannerLabel = $('label[for="my_file"]');
      var settingsDescriptionLabel = $('label[for="member[description]"]');
      var settingsLocationLabel = $('label[for="member[location]"]');
      var settingsHometownLabel = $('label[for="member[hometown]"]');
      var settingsBirthdayLabel = $('label[for="member[birthday]"]');
      var settingsGenderLabel = $('label[for="member[gender]"]');
      var settingsWebsiteLabel = $('label[for="member[website]"]');
      var settingsTwitterLabel = $('label[for="member[twitter]"]');

      var settingsUploading = false;

      function exitSettingsButton() {
        settingsButtonMask.show();
        settingsButton.removeClass('is-button-alert');
        resetSettingsStyles();
      }
      function resetSettingsStyles() {
        settingsNameLabel.css('color', 'gray');
        settingsUsernameLabel.css('color', 'gray');
        settingsEmailLabel.css('color', 'gray');
        settingsBirthdayLabel.css('color', 'gray');
      }

      settingsButtonMask.each(function (i) {
        var w = settingsButton.outerWidth();
        var h = settingsButton.outerHeight();
        settingsButtonMask.css({ width: w, height: h });
      });

      settingsButtonMask.bind('mouseenter', function () {
        var name = settingsName.val().trim();
        var username = settingsUsername.val().trim();
        var email = settingsEmail.val().trim();
        if (name !== '' && username !== ''
            && email !== '' && !settingsUploading) {
          settingsButtonMask.css('bottom', 10000).hide();
          resetSettingsStyles();
        } else {
          settingsButton.addClass('is-button-alert');
          if (name === '') 
            settingsNameLabel.css('color', colors.orange);
          if (username === '')
            settingsUsernameLabel.css('color', colors.orange);
          if (email === '') 
            settingsEmailLabel.css('color', colors.orange);
        }
      }).bind('mouseleave', exitSettingsButton);

      settingsButton.bind('mouseleave', function () {
        settingsButtonMask.css('bottom', 0);
        exitSettingsButton();
      });

      settingsButton.bind('click', function (e) {
        e.preventDefault();
        if (settingsUploading) return;
        var data = settingsForm.serializeObject();
        delete data.params;
        $.put('/save/settings', data, function (res) {
          if ('success' === res.status)
            return ui.notify('Edits saved.')
                     .closable().hide(8000).effect('fade').fit();
          if ('error' === res.status && res.data.inUse) {
            switch (res.data.inUse) {
              case 'primaryEmail':
                ui.error('Email address is already in use.')
                  .closable().hide(8000).effect('fade').fit();
                settingsEmail.focus();
                settingsEmailLabel.css('color', colors.orange);
                break;
              case 'username':
                ui.error('Username is already in use.')
                  .closable().hide(8000).effect('fade').fit();
                settingsUsername.focus();
                settingsUsernameLabel.css('color', colors.orange);
                break;
            }
          } else if ('error' === res.status && res.data.invalid) {
            switch (res.data.invalid) {
              case 'birthday':
                ui.error('Birthday not a valid date.')
                  .closable().hide(8000).effect('fade').fit();
                settingsBirthday.val('').focus();
                settingsBirthdayLabel.css('color', colors.orange);
                break;
            }
          }
        });
        return false;
      });

      settingsForm.transloadit({
        wait: true,
        autoSubmit: false,
        modal: false,
        processZeroFiles: false,
        onSuccess: function (assembly) {
          uploadSpin.stop();
          settingsBanner.show();
          if (assembly.ok !== 'ASSEMBLY_COMPLETED')
            return ui.error('Upload failed. Please try again.')
              .closable().hide(8000).effect('fade').fit();
          if ($.isEmpty(assembly.results) && settingsUploading)
            return ui.error('You must choose a file.')
              .closable().hide(8000).effect('fade').fit();
          if (settingsUploading) {
            var banner = assembly.results.image_thumb[0];
            var _w = 232, _h = 104;
            var w, h, o;
            w = _w;
            h = (banner.meta.height / banner.meta.width) * _w;
            if (h - _h >= 0) {
              o = 'top:' + (-(h - _h) / 2) + 'px;';
            } else {
              w = (banner.meta.width / banner.meta.height) * _h;
              h = _h;
              o = 'left:' + (-(w - _w) / 2) + 'px;';
            }
            settingsBanner.attr({
              src: banner.url,
              width: w,
              height: h,
              style: o,
            });
            settingsBannerData.val(JSON.stringify(assembly));
            settingsUploading = false;
            return;
          }
        },
      });

      settingsBannerFile.bind('change', function () {
        settingsUploading = true;
        settingsBanner.hide();
        uploadSpin.start();
        settingsForm.submit();
      });

      settingsBanner.bind('mousedown', function (e) {
        e.preventDefault();
        var w = { x: settingsBanner.width(),
                  y: settingsBanner.height() };
        var m = { x: e.pageX, y: e.pageY };
        var p = { x: parseInt(settingsBanner.css('left')),
                  y: parseInt(settingsBanner.css('top'))};
        var move = function (e) {
          var d = { x: e.pageX - m.x,
                    y: e.pageY - m.y };
          var top = d.y + p.y;
          var left = d.x + p.x;
          if (top <= 0 && w.y + top >= 104) {
            settingsBannerTop.val(top);
            settingsBanner.css({ top: top + 'px' });
          }
          if (left <= 0 && w.x + left >= 232) {
            settingsBannerLeft.val(left);
            settingsBanner.css({ left: left + 'px' });
          }
        };
        settingsBanner.bind('mousemove', move);
        settingsBanner.bind('mouseup', function (e) {
          settingsBanner.unbind('mousemove', move);
          settingsBanner.unbind('mouseup', arguments.callee);
        });
      });

      // new media
      var mediaForm = $('#media-form');
      var mediaButton = $('#add-media');
      var mediaButtonMask = $('#add-media-mask');
      var mediaTitle = $('input[name="post[title]"]');
      var mediaBody = $('textarea[name="post[body]"]');
      var mediaTags = $('input[name="post[meta.tags]"]');
      var mediaFile = $('input[name="my_file"]');
      var mediaTitleLabel = $('label[for="post[title]"]');
      var mediaBodyLabel = $('label[for="post[body]"]');
      var mediaTagsLabel = $('label[for="post[meta.tags]"]');

      function exitMediaButton() {
        mediaButtonMask.show();
        mediaButton.removeClass('is-button-alert');
        resetMediaStyles();
      }
      function resetMediaStyles() {
        mediaTitleLabel.css('color', 'gray');
        mediaBodyLabel.css('color', 'gray');
        mediaFile.css('color', 'gray');
      }

      mediaButtonMask.each(function (i) {
        var w = mediaButton.outerWidth();
        var h = mediaButton.outerHeight();
        mediaButtonMask.css({ width: w, height: h });
      });

      mediaButtonMask.bind('mouseenter', function () {
        var title = mediaTitle.val().trim();
        var body = mediaBody.val().trim();
        var file = mediaFile.val();
        if (title !== '' && body !== '' && file !== '') {
          mediaButtonMask.css('bottom', 10000).hide();
          resetMediaStyles();
        } else {
          mediaButton.addClass('is-button-alert');
          if (title === '') 
            mediaTitleLabel.css('color', colors.orange);
          if (body === '')
            mediaBodyLabel.css('color', colors.orange);
          if (file === '') 
            mediaFile.css('color', colors.orange);
        }
      }).bind('mouseleave', exitMediaButton);

      mediaButton.bind('mouseleave', function () {
        mediaButtonMask.css('bottom', 0);
        exitMediaButton();
      });

      mediaForm.transloadit({
        wait: true,
        autoSubmit: false,
        onSuccess: function (assembly) {
          if (assembly.ok !== 'ASSEMBLY_COMPLETED')
            return ui.error('Upload failed. Please try again.')
              .closable().hide(8000).effect('fade').fit();
          if ($.isEmpty(assembly.results))
            return ui.error('You must choose a file.')
              .closable().hide(8000).effect('fade').fit();
          var data = mediaForm.serializeObject();
          delete data.params;
          // data.params = JSON.parse(data.params);
          data.assembly = assembly;
          $.put('/insert', data, function (res) {
            if ('error' === res.status)
              return console.log(res.message);
            mediaTitle.val('');
            mediaBody.val('');
            mediaTags.val('');
            mediaFile = $('input[name="my_file"]');
          });
        },
      });
    },

    /**
     * Receive and render media.
     */

    receiveMedia: function (str) {
      var html = $(str);
      html.prependTo(jrid).css({ opacity: 0 });
      if (jrid.hasClass('adjustable-grid'))
        grid.collage(true);
      else grid.collage();
      html.animate({ opacity: 1 }, 500);
      updateTimes();
      initVideoSlides();
    },

    /**
     * Receive and render a comment.
     */

    receiveComment: function (str, mediaId) {
      var com = $(str);
      var comHolder = $('#coms-' + mediaId);
      var recHolder = $('#recent-comments');
      if (recHolder.length > 0) {
        $(recHolder.children()[recHolder.children().length - 1]).remove();
        if (recHolder.hasClass('no-member'))
          $('.comment-title-name', com).remove();
        com.hide().css({ opacity: 0 }).appendTo(recHolder);
        grid.collage(true, com.height());
        updateTimes();
        setTimeout(function () {
          com.prependTo(recHolder).show(250).animate({ opacity: 1 }, 500);
        }, 100);
      } else if (comHolder.length > 0) {
        com.hide().css({ opacity: 0 }).prependTo(comHolder);
        $('a.comment-title-parent', com).remove();
        grid.collage(true, com.height());
        updateTimes();
        setTimeout(function () {
          com.show(250).animate({ opacity: 1 }, 500);
        }, 100);
      }
    },

    /**
     * Receive and render an update.
     */

    receiveUpdate: function (ids, type, count) {
      _.each(ids, function (id) {
        var ctx = $('#' + id);
        if (ctx.length > 0) {
          var txt = $('.meta-' + type + 's', ctx);
          txt.text(Util.addCommas(count) + ' x ');
          // txt.siblings().hide();
          // _.delay(function () { txt.siblings().show(); }, 250);
        }
      });
    },

    /**
     * Receive and display current trends.
     */

    receiveTrends: function (err, media) {
      if (err) return console.log(err);
      trending.receive(media);
    },

  };

})(jQuery);


/**
 * Now.JS handlers
 */

now.receiveMedia = Island.receiveMedia;
now.receiveComment = Island.receiveComment;
now.receiveUpdate = Island.receiveUpdate;
now.receiveTrends = Island.receiveTrends;
