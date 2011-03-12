
Island = {};


function grid(el) {
  // grid vars
  var NUM_GRID = 50
    , NUM_FLOW = 25
    , GRID_OBJ_FREQ = {"482px":1,"231px":'*'}
    , COL_WIDTH = 231
    , COL_GAP_X = 20
    , COL_GAP_Y = 30
    , MIN_COLS = 2
    , MAX_COLS = 4
    , x_off = 0
    , y_off = 0
    , col_heights = []
  ;
  // determine the number of columns
  function num_cols() {
    return Math.min(Math.max(
        MIN_COLS
      , (parseInt(el.innerWidth()) + COL_GAP_X) / (COL_WIDTH + COL_GAP_X)
    )
    , MAX_COLS);
  }
  // methods 
  return {
    collage: function () {
      // calc num cols once
      var nc = num_cols();
      // clear column height array
      for (var x = 0; x < nc; x++) 
        col_heights[x] = 0;
      
      // loop over each object in grid
      $('.each-grid-obj').each(function (i) {
        
        var self = $(this)
          , obj_col = 0
          , obj_y = 0
          
          // determine how many columns the object will span
          , obj_span = Math.max(Math.round(self.outerWidth() / COL_WIDTH), 1)
        ;
        
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
        self.css("left", obj_col * (COL_WIDTH + COL_GAP_X) + x_off).css('top', obj_y + y_off);
      });
      
      // add the column gap to the bottom of the collage
      el.height(Math.max.apply(Math, col_heights) - COL_GAP_Y + 'px');
    }
  }
   
}


/*###########################################################################
################################################################### DOC READY  
###########################################################################*/
$(function() {
	//–––––––––––––––––––––––––––––––––––––––––––––––––––––––––– EXTEND UTILS
	// on core classes
	String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g,""); }
	String.prototype.ltrim = function() { return this.replace(/^\s+/,""); }
	String.prototype.rtrim = function() { return this.replace(/\s+$/,""); }
	// on jquery
	$.extend({
		addCommas:function(nStr) {
			nStr += '';
			x = nStr.split('.');
			x1 = x[0];
			x2 = x.length>1 ? '.'+x[1] : '';
			var rgx = /(\d+)(\d{3})/;
			while(rgx.test(x1)) x1 = x1.replace(rgx,'$1'+','+'$2');
			return x1+x2;
		},
		is_numeric:function(t) {
			var vc = "0123456789"; var is_n = true; var c;
		    for(var i=0; i<t.length && is_n==true; i++) { 
		 		c = t.charAt(i); 
		      	if(vc.indexOf(c)==-1) is_n = false;
		   	} return is_n;
		},
		setTimeoutObj:function(o,t,f,a) {
			return setTimeout(function() { f.apply(o,a); },t);
		},
		setIntervalObj:function(o,t,f,a) {
			return setInterval(function() { f.apply(o,a); },t); 
		},
		fisherYates:function(a) {
		  var i = a.length;
		  if(i==0 ) return false;
		  while(--i) {
		     var j = Math.floor(Math.random()*(i+1));
		     var tempi = a[i];
		     var tempj = a[j];
		     a[i] = tempj;
		     a[j] = tempi;
		   }
		}
	});

	// logo flash
	Island.pulse = function(a,b) {
		if(Island.pulseCnt % 2 == 0) $(b).fadeTo(500,0.75);
		else $(b).fadeTo(500,1);
		Island.pulseCnt += 1;
	};
	Island.cancelPulse = function() {
		clearInterval(Island.pulseTimer);
		clearTimeout(Island.pulseCancel);
		$("#logo-a").show();
		$("#logo-b").hide();
	};
	Island.pulseCnt = 0;
	
	
	// tweets
  Island.twitters = ['plebeiantv'];
  Island.tweets = [];
  Island.twut = 0;
  
  Island.twit = function () {
    var twap = $('#twitter');
    twap.hide().html(Island.tweets[Island.twut]);
    twap.fadeIn('fast');
    Island.twut++;
    if (Island.twut == Island.tweets.length) 
      Island.twut = 0;
  };
  
  Island.twat = function (t) {
    Island.tweets = Island.tweets.concat(t);
    $.fisherYates(Island.tweets);
  };
  
 
	// tweets
  for (var tt in Island.twitters)
    $.tweet({
        username: Island.twitters[tt]
      , callback: Island.twat
    });
    
  Island.tweeter = $.setIntervalObj(this, 5000, Island.twit);
  setTimeout(Island.twit, 1000);
	
	
	
	//––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– SETUP DOC
	// define console to avoid errors when Firebug isn't available
	if (!window.console)
	  window.console = { log:function(){} };
	// logo mouse over
	$("#logo").bind("mouseover", function () {
		$("#logo-a").hide();
		$("#logo-b").show();
		var logos = [ $("#logo-a"), $("#logo-b") ];
		Island.pulse(logos[0], logos[1]);
		Island.pulseTimer = $.setIntervalObj(this, 500, Island.pulse, logos);
		Island.pulseCancel = $.setTimeoutObj(this, 5000, Island.cancelPulse);
	});
	$("#logo").bind("mouseout",function() {
		Island.cancelPulse();
	});
	
	
	
	
	
	
  $('#goto-register-form a').live('click', function () {
    $('#login-form').hide();
    $('#register-form').fadeIn('fast');
    $(this.parentNode).hide();
    $('#goto-login-form').show();
    $('input[name="newmember[name.first]"]').focus();
  });
  
  $('#goto-login-form a').live('click', function () {
    $('#register-form').hide();
    $('#login-form').fadeIn('fast');
    $(this.parentNode).hide();
    $('#goto-register-form').show();
    $('input[name="member[email]"]').focus();
  });
	
	
	$('input[name="member[email]"]').focus();
	
	
  
  
  
  function hideFlashMessages() {
    $(this).fadeOut();
  }

  setTimeout(function() {
    $('.flash').each(hideFlashMessages);
  }, 5000);
  $('.flash').click(hideFlashMessages);
  
  
  
	
	// rss, archipelago
  // $('.is-archipelago').live('mouseenter',function() {
  //     var $this = $(this)
  //       , src = $this.attr('alt')
  //    , alt = $this.attr('src')
  //  ;
  //  $(this).attr('src', src).attr('alt', alt);
  // }).live('mouseleave',function() {
  //  var $this = $(this)  
  //    , src = $this.attr('alt')
  //    , alt = $this.attr('src')
  //  ;
  //  $this.attr('src', src).attr('alt', alt);
  // });
	
	
	
	$(window).scroll(function() {
		if($(this).scrollTop()>0) {
			$('#feeds').css({ opacity:0 });
			$('#menu,#feeds,.members-bar').hide();
			$('#header').css({ width:363 });
		} else if($(this).scrollTop()==0) {
			$('#header').css({ width:984 });
			$('#menu,#feeds,.members-bar').show();
			$('#feeds').css({ opacity:1 });
		}
	});


  

    
  // position rollovers
  $('.each-grid-obj').each(function (i) {
    $('.grid-obj-hover', this).hide();
  });
  
  grid($('#grid')).collage();

  
  // rollover each object
  $('.grid-obj-img').live('mouseenter', function () {
    
    $(this.previousElementSibling).show();
  
  });
  $('.grid-obj-hover').live('mouseleave', function () {
    
    $(this).fadeOut(100);
  
  });
  
  
  // comment on media
  $('.commentor-input-dummy').live('focus', function () {
    $(this).hide();
    $(this.nextElementSibling).show();
    $(this.nextElementSibling.firstElementChild).focus();
	});
	$('.commentor-input').live('blur', function () {
    if (this.value == '') {
      $(this.parentNode).hide();
      $(this.parentNode.previousElementSibling).show();
    }
	});
	
	$('textarea').autogrow();
	
	
	
	
	// login focus and blur
	$('#login-form > input[type="text"], #login-form > input[type="password"]').live('focus', function () {
    if (this.value == this.name) 
      $(this).val('').css('color','#404040');
	}).live('blur', function () {
    if (this.value == '') 
      $(this).val(this.name).css('color','#808080');
	});
	
	
	
	
	
	// Easily get an item's database ID based on an id attribute
  $.fn.itemID = function() {
    try {
      var items = $(this).attr('id').split('-');
      return items[items.length - 1];
    } catch (exception) {
      return null;
    }
  };

  $.put = function(url, data, success) {
    data._method = 'PUT';
    $.post(url, data, success, 'json');
  };
  

	$('.add-comment').live('click', function () {
	  
	  var comment = $(this.previousElementSibling).val().trim();
	  
	  if (comment == '') return false;
	  
	  $(this.previousElementSibling).val('');
	  $(this.parentNode).hide();
    $(this.parentNode.previousElementSibling).show();
	  
    var id = $(this).itemID()
        , params = { 
            d: { 
                data: comment 
              , id: id 
            } 
          };
        
    $.put('/comment/' + id + '.json', params, function (data) {
      $(data.comment).hide().prependTo('#obj-comments').show('fast');
    });
    
  });
	
  function toggleOverlay() {
    document.body.className = document.body.className.indexOf('overlaid') != -1 ? '' : 'overlaid';
  }
  
  $('.login').live('click', function (e) {
    
    $('#twitter').hide();
    $('#login-form').fadeIn('fast');
    
    //toggleOverlay();
  });
  
  $('.toggle-overlay').live('click', function (e) {
    toggleOverlay();
  });
  
  $('#logout').live('click', function (e) {
    e.preventDefault();
    if (confirm('Are you sure you want to log out?')) {
      var element = $(this),
          form = $('<form></form>');
      form
        .attr({
          method: 'POST',
          action: '/sessions'
        })
        .hide()
        .append('<input type="hidden" />')
        .find('input')
        .attr({
          'name': '_method',
          'value': 'delete'
        })
        .end()
        .submit();
    }
  });
  
  
/*###########################################################################
################################################################### NEW MEDIA  
###########################################################################*/
    
  var mediaForm = $('#media-form')
    , mediaButton = $('#add-media')
    , mediaButtonMask = $('#add-media-mask')
    , mediaTitle = $('input[name="media[title]"]')
    , mediaBody = $('textarea[name="media[body]"]')
    , mediaTags = $('input[name="media[meta.tags]"]')
    , mediaFile = $('input[name="my_file"]')
    , mediaTitleLabel = $('label[for="media[title]"]')
    , mediaBodyLabel = $('label[for="media[body]"]')
    , mediaTagsLabel = $('label[for="media[meta.tags]"]')
    , mediaFileLabel = $('label[for="my_file"]')
  ;
  
  mediaButtonMask.each(function (i) {
    var w = mediaButton.outerWidth()
      , h = mediaButton.outerHeight()
    ;
    mediaButtonMask.css({ width: w, height: h });
  });
  
  mediaButtonMask.bind('mouseenter', function () {
    var title = mediaTitle.val().trim()
      , body = mediaBody.val().trim()
      , file = mediaFile.val()
    ;
    if (title != '' && body != '' && file != '') {
      mediaButtonMask.css('bottom', 10000).hide();
      resetMediaStyles();
    } else {
      mediaButton.addClass('is-button-alert');
      if (title == '') 
        mediaTitleLabel.css('color', 'red');
      if (body == '')
        mediaBodyLabel.css('color', 'red');
      if (file == '') 
        mediaFileLabel.css('color', 'red');
    }
  }).bind('mouseleave', exitMediaButton);
  
  function exitMediaButton() {
    mediaButtonMask.show();
    mediaButton.removeClass('is-button-alert');
    resetMediaStyles();
  }
  
  function resetMediaStyles() {
    mediaTitleLabel.css('color', 'gray');
    mediaBodyLabel.css('color', 'gray');
    mediaFileLabel.css('color', 'gray');
  }

  mediaButton.bind('mouseleave', function () {
    mediaButtonMask.css('bottom', 0);
    exitMediaButton();
  });
  
  mediaForm.transloadit({
      autoSubmit: false
    , onSuccess: function (assembly) {
        console.log(assembly);
        if (assembly.ok != 'ASSEMBLY_COMPLETED') {
          alert('Upload failed. Please try again.');
          return;
        }
        if ($.isEmpty(assembly.results)) {
          alert('You must choose a file to contribute.');
          return;
        }
        var data = mediaForm.serializeObject();
        data.params = JSON.parse(data.params);
        data.assembly = assembly;
        $.put('/transloadit', data, function (data) {
          if (data.err)
            alert(data.err);
          else {
            mediaTitle.val('');
            mediaBody.val('');
            mediaFile.val('');
          }
        });
      }
  });
  
  $.fn.serializeObject = function () {
    var o = {}
      , a = this.serializeArray()
    ;
    $.each(a, function () {
      if (o[this.name]) {
        if (!o[this.name].push)
          o[this.name] = [o[this.name]];
        o[this.name].push(this.value || '');
      } else
        o[this.name] = this.value || '';
    });
    return o;
  };
  
  $.isEmpty = function (o) {
  	for (var p in o)
  		if (o.hasOwnProperty(p))
  			return false;
  	return true;
  }

});







