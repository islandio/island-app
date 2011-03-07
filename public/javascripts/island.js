/*--------------------------------------------------------------------------.
|  Software: WeAreIsland.com		                                  		|
|   Version: 1.0                                                            |
|   Contact: spick@cleanenergysolutionsinc.com 								|                
| ------------------------------------------------------------------------- |
|     Admin: Sander Pick (project admininistrator)                          |
|   Authors: Sander Pick                         							|
| Copyright (c) 20010-Today Digijoi. All Rights Reserved.			       	|                     
| ------------------------------------------------------------------------- |
|   License: By downloading or copying any part of this file,	 			|
|			 you agree to the following: 									|
|			* The product may not be used for commercial projects. 			|
|			* You are not free to remove the copyright information.			|
| 			* You are not free to use or copy any of this file.             |
'--------------------------------------------------------------------------*/
/*###########################################################################
###################################################################### GLOBAL
###########################################################################*/

// var socket = new io.Socket(null, { port: 3000, rememberTransport: false });
// socket.connect();
// socket.on('connect', function () {
//  console.log('connected to server...');
// }); 
// socket.on('message', function() {
//  console.log('received message from server...');
// }); 
// socket.on('disconnect', function () {
//  console.log('disconnected from server...');
// });

Island = {};


// /*###########################################################################
// ##################################################################### MODULES
// ###########################################################################*/
// // base class for all modules
// var Module = Class.extend({
//  added:false, plugins:{},
//  init:function(el,io) { this.el = el; this.io = io; },
//  done:function() { },
//    show:function(holder,method,full) {
//    // wrap element
//    var wrapper = full ? "<div style='display:none; width:984px;' id='"+this.el.substring(1)+"'></div>" : "<div style='display:none;' id='"+this.el.substring(1)+"'></div>";
//    // add to doc
//    switch(method) {
//      case "pre" : $(holder).prepend(wrapper); break;
//      case "app" : $(holder).append(wrapper); break;
//      case "grid" : $(holder).html(wrapper); break;
//      default :
//        if(Island.view) {
//          if(Island.view!="obj") {
//            Island[Island.view].stop();
//            $(Island[Island.view].el).remove();
//          } else {
//            Island.grid.obj.stop();
//            $(Island.grid.obj.el).remove();
//          }
//        }
//        $(holder).html(wrapper);
//        break;
//    }
//    // fill in
//    $(this.el).html(this.iHTML());
//    // show
//    $(this.el).fadeIn("fast");
//  },
//  hide:function() { var t = this; $(t.el).fadeOut("fast",function() { t.clear(); }); },
//  begin:function() { },
//  clear:function() { $(this.el).remove(); },
//  iHTML:function() { },
//  receive:function() { },
//  stop:function() { this.added = false; }
// });
// ////////////////////////////////////////////////////////////// login : public
// var Login = Module.extend({
//    init:function(el,io) {
//    this._super(el,io); var t = this;
//    // show login form
//    $("a[title='Login']").live("click",function() {
//      t.request();
//    });
//    // setup login form
//    $(":input[title='Sign In']").live("click",function() {
//      var ds = $("form.login-form").postify("rememberme");
//      if(ds=="") return false;
//      // store attempted username / pass for cookies
//      if($("#rememberme").attr("checked")) {
//        t.try_username = $("#mem_login").val();
//        t.try_password = $("#mem_pass").val();
//        t.setCookie = true;
//      } else t.setCookie = false;
//      // try to log in
//      t.io.request(t,ds+"is_do=login");
//    });
//    // setup logout link
//    $("a[title='Logout']").live("click",function() {
//      t.io.request(t,"exit=yes&is_do=logout");
//    });
//  },
//  done:function() { this._super(); },
//    show:function(type,holder) {
//    switch(type) {
//      case "login" :
//        this.iHTML = function() {
//          // check for cookies
//          var default_login = ($.get_cookie('ismem_login')!="") ? $.get_cookie('ismem_login') : "username";
//          var default_pass = ($.get_cookie('ismem_pass')!="") ? $.get_cookie('ismem_pass') : "password";
//          var password_type = (default_pass=="password") ? "text" : "password";
//          // build notify vars
//          var message = (this.message!="") ? "<h2 class='message'>"+this.message+"&nbsp;</h2>" : "";
//          var error = (this.error!="") ? "<h2 class='error'>"+this.error+"&nbsp;</h2>" : "";
//          this.message = ""; this.error = "";
//          return "<div class='members-bar'> \
//                "+message+error+" \
//                <form class='login-form'> \
//                  <input class='required' type='text' name='username' id='mem_login' style='display:inline; margin:0 2px 0 0; font-weight:bold; width:105px; font-size:10px;' value='"+default_login+"' /> \
//                  <input class='required' type='"+password_type+"' name='password' id='mem_pass' value='"+default_pass+"' style='display:inline; margin:0; font-weight:bold; width:104px; font-size:10px;' /> \
//                  <!--<label for='rememberme' style='margin-left:2px; display:inline-block; margin-top:8px;'> \
//                    <input type='checkbox' id='rememberme' tabindex='90' value='forever' name='rememberme' /> Save \
//                  </label>--> \
//                  <input type='submit' title='Sign In' value='Sign In' style='margin-left:2px; font-size:10px; padding:4px 10px;' /> \
//                </form> \
//                <div class='clear'></div> \
//              </div>";
//        };
//        break;
//      case "failed" :
//        this.iHTML = function() {
//          // build notify vars
//          var message = (this.message!="") ? "<h2 class='message'>"+this.message+"&nbsp;</h2>" : "";
//          var error = (this.error!="") ? "<h2 class='error'>"+this.error+"&nbsp;</h2>" : "";
//          this.message = ""; this.error = "";
//          return "<div class='members-bar'> \
//                <a href='javascript:;' title='Login' style='float:right; padding:4px 0 0 0;'>Try Again</a> \
//                "+message+error+" \
//                <form class='login-form'> \
//                  <input class='required' type='text' name='username' id='mem_login' style='display:inline; margin:0 2px 0 0; font-weight:bold; width:105px; font-size:10px;' value='' /> \
//                  <input class='required' type='password' name='password' id='mem_pass' value='' style='display:inline; margin:0; font-weight:bold; width:104px; font-size:10px;' /> \
//                  <!--<label for='rememberme' style='margin-left:2px; display:inline-block; margin-top:8px;'> \
//                    <input type='checkbox' id='rememberme' tabindex='90' value='forever' name='rememberme' /> Save \
//                  </label>--> \
//                  <input type='submit' title='Sign In' value='Sign In' style='margin-left:3px; font-size:10px; padding:4px 10px;' /> \
//                </form> \
//                <div class='clear'></div> \
//              </div>";
//        };
//        break;
//      case "logout" :
//        this.iHTML = function() {
//          // build notify vars
//          var message = (this.message!="") ? "<h2 class='message'>"+this.message+"&nbsp;</h2>" : "";
//          var error = (this.error!="") ? "<h2 class='error'>"+this.error+"&nbsp;</h2>" : "";
//          this.message = ""; this.error = "";
//          return "<div class='members-bar'> \
//                <span style='float:right; padding:4px 0 0 0;'> \
//                  Yo, <span style='font-weight:bold;'>"+Island.member.mem_name_first+" "+Island.member.mem_name_last+"</span>. \
//                  <a href='javascript:;' title='Logout'>Logout</a> \
//                 </span> \
//                "+message+error+" \
//                <div class='clear'></div> \
//              </div>";  
//        };
//        break;
//    }
//    this._super(holder,"app",false); 
//  },
//  hide:function() { this._super(); },
//  begin:function() {
//    this._super();
//    // attempt to resume last session
//    this.io.request(this,"is_do=resume");
//  },
//  clear:function() { this._super(); },
//  iHTML:function() { },
//  receive:function(json) {
//    this._super();
//    // parse data received for login requests
//    switch(json.did) {
//      case "resume" : case "login" :
//        // store rep info on login
//        Island.member = json.data;
//        // set cookie if checked
//        if(this.setCookie) {
//          $.set_cookie("ismem_login",this.try_username,365);
//          $.set_cookie("ismem_pass",this.try_password,365);
//        }
//        // determine user role
//        switch(json.data.mem_role) {
//          case "0" : case "1" :
//            this.docTitle = "You're ISLAND";
//            break;
//        }
//        // set the title
//        document.title = this.docTitle;
//        // clear if not a resume
//        if(json.did=="login") {
//          this.clear();
//          $("#nav-contribute").show();
//        }
//        // show logout link
//        this.show("logout","#menu");
//        // do the next action in start sequence
//        for(var m in this.sequence) if(!this.sequence[m].added) this.sequence[m].begin();
//        delete Island.sequence;
//        // check if action waiting
//        if(Island.onDeck) { 
//          Island.onDeck.begin(); 
//          delete Island.onDeck;
//        }
//        break;
//      case "logout" :
//        // start featured
//        if(Island.view!="featured") Island.featured.begin();
//        // clear rep info
//        delete Island.member;
//        // set the title
//        this.docTitle = "We're ISLAND";
//        document.title = this.docTitle;
//        // clear
//        this.clear();
//        // notify action
//        this.message = "You are now logged out.";
//        // show login form
//        this.show("login","#menu");
//        break;
//      case "cant resume" :
//        // set the title
//        this.docTitle = "We're ISLAND";
//        document.title = this.docTitle;
//        // show login form
//        this.show("login","#menu");
//        // do the next action in start sequence
//        for(var m in this.sequence) this.sequence[m].begin();
//        delete Island.sequence;
//        // check if action waiting
//        if(Island.onDeck) { 
//          this.request();
//        }
//        break;
//      default :
//        // clear
//        this.clear();
//        // show error message
//        this.error = "The username or password you entered is incorrect.";
//        // show login form
//        this.show("failed","#menu");
//        break;
//    }
//  },
//  stop:function() { this._super(); },
//  message:"",
//  error:"",
//  request:function() {
//    $("h2.message,h2.error").remove();
//    $("#nav-contribute").hide();
//    $("a[title='Login']").hide();
//    $(".login-form").fadeIn("slow");
//    $("#mem_login").focus();
//  }
// });
// /////////////////////////////////////////////////////////// featured : public
// var Featured = Module.extend({
//  // private vars
//  SLIDE_WIDTH:640, SLIDE_HEIGHT:320, limit:10,
//    init:function(el,io) {
//    this._super(el,io); var t = this;
//    // click each featured object
//    $(".each-fea-obj",$(t.el)).live("click",function() {
//      Island.grid.open(this.id.substring(4));
//    });
//  },
//  done:function() { this._super(); },
//    show:function(holder) { this._super(holder,null,true); },
//  hide:function() { this._super(); },
//  begin:function() {
//    this._super();
//    // add to doc
//    this.show("#main-top");
//    this.added = true;
//    // get the featured content
//    this.io.request(this,"limit="+this.limit+"&is_do=getFeatured");
//    // set global
//    Island.view = "featured";
//    // set nav
//    Island.setNav($("a#nav-"+Island.view+" > h1"));
//  },
//  clear:function() { this._super(); },
//  iHTML:function() { 
//    this._super(); 
//    // send back
//    return "<div style='float:left;'> \
//          <h1 class='media-title2'>/ Featured <a href='javascript:;' style='padding:0 0 0 5px;'><img class='rss-icon' src='gfx/is-rss.png' alt='gfx/is-rss-hover.png' title='Follow ISLAND Featured Content' height='21'></a></h1> \
//          <div id='fea-carousel'> \
//            <div id='fea-carousel-wrap'> \
//              <div id='fea-carousel-holder'></div> \
//            </div> \
//          </div> \
//        </div> \
//        <div style='margin-left:670px;'> \
//          <h1 class='side-title2'>/ Metrics</h1> \
//          <div id='all-metrics'></div> \
//        </div> \
//        <div class='clear'></div>";
//  },
//  receive:function(json) {
//    // parse data received for login requests
//    switch(json.did) {
//      case "got featured" :
//        // save ref
//        var t = this;
//        // write list for slider
//        var html = "";
//        for(var f in json.data) {
//          // what type of object?
//          var source = "";
//          switch(json.data[f].obj_type) {
//            case 'image' :
//              source = json.data[f].obj_handle.substring(1)+'_featured.jpg';
//              break;
//            case 'video' :
//              source = json.data[f].obj_handle.substring(1)+'_featured.gif';
//              break;
//          }
//          html += "<div id='fea-"+json.data[f].ID+"' class='each-fea-obj'><img width='"+this.SLIDE_WIDTH+"' height='"+this.SLIDE_HEIGHT+"' alt='"+json.data[f].obj_title+"' src='"+source+"' title='from "+json.data[f].obj_owner+"' /></div>";
//        }
//        $("#fea-carousel-holder").html($(html));
//        // setup slider
//        $("#fea-carousel-wrap").scrollable({
//          vertical:true,
//          mousewheel:true,
//          easing:"swing",
//          keyboard:true,
//          speed:500,
//          onSeek:function() {
//            if(t.plugins.api.getIndex()==t.plugins.api.getSize()-1) {
//              t.plugins.timer = $.setTimeoutObj(this,5000,t.plugins.api.begin,[t.plugins.api.getConf().speed]);
//            }
//          }
//        }).autoscroll({ interval:5000,autoplay:true });
//        // store scrollable api
//        this.plugins.api = $("#fea-carousel-wrap").data("scrollable");
//        // show
//        $("#fea-carousel-holder").fadeTo("fast",1);
//        // load the grid
//        if(!Island.grid.added) Island.grid.begin();
//        break;
//      default :
//        console.log(json.did);
//        break;
//    }
//  },
//  stop:function() {
//      this._super();
//    // stop slider
//    if(this.plugins.timer) clearTimeout(this.plugins.timer);
//    // stop autoscroll
//    if(this.plugins.api) this.plugins.api.stop();
//    // delete api
//    if(this.plugins.api) this.plugins.api.getConf().onSeek = null;
//  }
// });
// //////////////////////////////////////////////////////////// members : public
// var Members = Module.extend({
//  // private vars
//  SLIDE_WIDTH:984, SLIDE_HEIGHT:320,
//    init:function(el,io) {
//    this._super(el,io); var t = this;
//    // click each featured object
//    $(".each-mem",$(t.el)).live("click",function() {
//      //Island.grid.open(this.id.substring(4));
//    });
//  },
//  done:function() { this._super(); },
//    show:function(holder) { this._super(holder,null,true); },
//  hide:function() { this._super(); },
//  begin:function() {
//    this._super();
//    // add to doc
//    this.show("#main-top");
//    this.added = true;
//    // get the featured content
//    //this.io.request(this,"limit="+this.limit+"&is_do=getMembers");
//    // set global
//    Island.view = "members";
//    // set nav
//    Island.setNav($("a#nav-"+Island.view+" > h1"));
//    // temp !
//    // setup slider
//    // save ref
//    var t = this;
//    $("#mem-carousel-wrap").scrollable({
//      mousewheel:true,
//      easing:"swing",
//      keyboard:true,
//      speed:500,
//      onSeek:function() {
//        if(t.plugins.api.getIndex()==t.plugins.api.getSize()-1) {
//          t.plugins.timer = $.setTimeoutObj(this,5000,t.plugins.api.begin,[t.plugins.api.getConf().speed]);
//        }
//      }
//    }).autoscroll({ interval:5000,autoplay:true });
//    // store scrollable api
//    this.plugins.api = $("#mem-carousel-wrap").data("scrollable");
//    // show
//    $("#mem-carousel-holder").fadeTo("fast",1);
//    // load the grid
//    if(!Island.grid.added) Island.grid.begin();
//  },
//  clear:function() { this._super(); },
//  iHTML:function() { 
//    this._super(); 
//    // send back
//    return "<h1 class='media-title2'>/ Members</h1> \
//        <div id='mem-carousel'> \
//          <div id='mem-carousel-wrap'> \
//            <div id='mem-carousel-holder'> \
//              <div id='mem-1'> \
//                <section class='mem-profile'> \
//                  <article> \
//                    <div class='profile-left'> \
//                          <ul> \
//                        <li><h1 class='prof-spec'>Home Town:</h1>Portland, Maine</li> \
//                        <li><h1 class='prof-spec'>Current City:</h1>Boulder, CO</li> \
//                        <li><h1 class='prof-spec'>Sponsors:</h1>Five Ten, North Face, Metolius</li> \
//                        <li><h1 class='prof-spec'>Music Likes:</h1>Rock n\' Roll</li> \
//                      </ul> \
//                      </div> \
//                    <div class='profile-right'> \
//                      <div> \
//                            <img src='img/mem-1.png' title='David Graham' alt='David Graham' /> \
//                        </div> \
//                    </div> \
//                    <div class='clear'></div> \
//                  </article> \
//                </section> \
//              </div> \
//            </div> \
//          </div> \
//        </div> \
//        <div class='clear'></div>";
//  },
//  receive:function(json) {
//    // parse data received for login requests
//    switch(json.did) {
//      case "got members" :
//        // // save ref
//        // var t = this;
//        // // write list for slider
//        // var html = "";
//        // for(var m in json.data) {
//        //  html += "<div id='mem-"+json.data[f].ID+"' class='each-mem'></div>";
//        // }
//        // $("#mem-carousel-holder").html($(html));
//        // // setup slider
//        // $("#mem-carousel-wrap").scrollable({
//        //    vertical:true,
//        //  mousewheel:true,
//        //    easing:"swing",
//        //    keyboard:true,
//        //  speed:500,
//        //  onSeek:function() {
//        //    if(t.plugins.api.getIndex()==t.plugins.api.getSize()-1) {
//        //      t.plugins.timer = $.setTimeoutObj(this,5000,t.plugins.api.begin,[t.plugins.api.getConf().speed]);
//        //    }
//        //  }
//        // }).autoscroll({ interval:5000,autoplay:true });
//        // // store scrollable api
//        // this.plugins.api = $("#mem-carousel-wrap").data("scrollable");
//        // // show
//        // $("#mem-carousel-holder").fadeTo("fast",1);
//        // // load the grid
//        // if(!Island.grid.added) Island.grid.begin();
//        break;
//      default :
//        console.log(json.did);
//        break;
//    }
//  },
//  stop:function() {
//      this._super();
//    // stop slider
//    if(this.plugins.timer) clearTimeout(this.plugins.timer);
//    // stop autoscroll
//    if(this.plugins.api) this.plugins.api.stop();
//    // delete api
//    if(this.plugins.api) this.plugins.api.getConf().onSeek = null;
//  }
// });
// //////////////////////////////////////////////////////////// mission : public
// var Mission = Module.extend({
//    init:function(el,io) { this._super(el,io); var t = this; },
//  done:function() { this._super(); },
//   show:function(holder) { this._super(holder,null,true); },
//  hide:function() { this._super(); },
//  begin:function() {
//    this._super();
//    // add to doc
//    this.show("#main-top");
//    this.added = true;
//    // set global
//    Island.view = "mission";
//    // set nav
//    Island.setNav($("a#nav-"+Island.view+" > h1"));
//    // load the grid
//    if(!Island.grid.added) Island.grid.begin();
//  },
//  clear:function() { this._super(); },
//  iHTML:function() {
//    this._super(); 
//    // send back
//    return "<div style='float:left;'> \
//          <p class='mission-txt'> \
//            &quot;But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure.&quot; \
//          </p> \
//        </div> \
//        <div style='margin-left:670px; text-align:right;'> \
//          <img id='archipelago' src='gfx/is-archipelago.png' title='Archipelago' alt='gfx/is-archipelago-hover.png' /> \
//        </div> \
//        <div class='clear'></div>";
//  },
//  receive:function(json) {
//    this._super();
//    // parse data received
//    switch(json.did) { default : break; }
//  },
//  stop:function() { this._super(); }
// });
// //////////////////////////////////////////////////////// contribute : members
// var Contribute = Module.extend({
//   init:function(el,io) {
//    this._super(el,io); var t = this;
//    // setup upload fields
//    $("input[type='checkbox']",$(t.el)).live("click",function() {
//      if($("#upload").uploadifySettings("scriptData").up_featured==0) $("#upload").uploadifySettings("scriptData",{ up_featured:1 });
//      else $("#upload").uploadifySettings("scriptData",{ up_featured:0 });
//    });
//    $("input[type='text'], textarea",$(t.el)).live("keyup",function() {
//      switch($(this).attr("id")) {
//        case "up_title" : $("#upload").uploadifySettings("scriptData",{ up_title:$(this).val().trim() }); break;
//        case "up_desc" : $("#upload").uploadifySettings("scriptData",{ up_desc:$(this).val().trim() }); break;
//        case "up_tags" : $("#upload").uploadifySettings("scriptData",{ up_tags:$(this).val().trim() }); break; 
//      }
//    });
//    // cancel hover
//    $(".cancel img").live("mouseenter",function() {
//      $(this).attr("src","gfx/cancel-hover.png");
//    });
//    $(".cancel img").live("mouseleave",function() {
//      $(this).attr("src","gfx/cancel.png");
//    });
//    // upload
//    $("input[title='Post']").live("click",function() {
//      $("#upload").uploadifyUpload();
//    });
//  },
//  done:function() { this._super(); },
//   show:function(holder) { this._super(holder,null,true); },
//  hide:function() { this._super(); },
//  begin:function() {
//    this._super();
//    // add to doc
//    this.show("#main-top");
//    this.added = true;
//    // init upload
//    $("#upload").uploadify(this.uploadParams());
//    // move upload queue
//    $("#uploadQueue").appendTo("#all-uploads").html("<p class='no-pending-txt'>no files pending...</p>");
//    // set global
//    Island.view = "contribute";
//    // set nav
//    Island.setNav($("a#nav-"+Island.view+" > h1"));
//    // load the grid
//    if(Island.grid.content=="filtered") Island.grid.begin();
//  },
//  clear:function() { this._super(); },
//  iHTML:function() {
//    this._super();
//    // make vars
//    var admin_fields = (Island.member.mem_role!=0) ? "" : "<br /><input type='checkbox' name='up_featured' id='up_featured' />&nbsp;&nbsp;<span style='font-size:11px;'>Feature this content?</span>";
//    // return the form
//    return "<h1 class='media-title2'>/ Contribute</h1> \
//        <div id='contribute-wrap'> \
//          <div id='all-uploads' style='float:left;'> \
//            <div style='position:relative;'> \
//              <h3 class='add-media'>Upload images, videos, or music with this post:</h3> \
//              <div id='upload-holder' title='Select Files'>Choose Media \
//                <span id='upload'></span> \
//              </div> \
//            </div> \
//            <br /> \
//            <label>File Queue</label> \
//            <br /> \
//          </div> \
//          <div style='margin-left:464px;'> \
//            <form id='upload-form'> \
//              <div style='padding:0 0 20px 0;'> \
//                <h3 class='add-media' style='float:left;'>New Post / Media Info:</h3> \
//                <input type='submit' title='Post' value='Post' style='float:right;' /> \
//              </div> \
//              <br /> \
//              <label for='up_title'>Title</label> \
//              <input type='text' title='Post Title' name='(optional)' id='up_title' value='(optional)' style='width:488px;' /> \
//              <label for='up_desc'>Content / Description</label> \
//              <textarea title='Post Content' id='up_desc' style='width:488px; height:132px;'></textarea> \
//              <label for='up_tags'>Tags</label> \
//              <input type='text' title='Post Tags' name='(comma separated)' id='up_tags' value='(comma separated)' style='width:488px; margin-bottom:0;' /> \
//              "+admin_fields+" \
//            </form> \
//          </div> \
//          <div class='clear'></div> \
//        </div>";
//  },
//  receive:function(json) {
//    this._super();
//    // parse data received
//    switch(json.did) { default : break; }
//  },
//  stop:function() { this._super(); },
//  uploadParams:function() {
//    var t = this;
//    return {
//      uploader:"../swf/uploadify.swf",
//      expressInstall:"../swf/expressInstall.swf",
//      script:"includes/is-upload.php",
//      cancelImg:"../gfx/cancel.png",
//      wmode:"transparent",
//      hideButton:true,
//      auto:false,
//      multi:true,
//      width:84,
//      height:19,
//      fileDesc:"You may upload multiple files at once, but only the first will include your title and description.",
//      fileExt:"*.jpg;*.jpeg;*.png;*.gif;*.mp4;",
//      scriptData:{
//        up_title:"",
//        up_desc:"",
//        up_tags:"",
//        up_featured:"0",
//        mem_id:Island.member.ID,
//        mem_key:Island.member.mem_key,
//      },
//      onComplete:function(e,qid,f,r,d) {
//        Island.grid.append(r);
//      },
//      onAllComplete:function() {
//        $("#up_title,#up_tags,#up_desc").val("").blur();
//        $("#up_featured").attr("checked",false);
//        $(".uploadifyQueue").html("<p class='no-pending-txt'>no files pending...</p>");
//      }
//    }
//  }
// });
// ///////////////////////////////////////////////////////////// object : public
// var Obj = Module.extend({
//  // private vars
//  OBJ_WIDTH:640,
//   init:function(el,io) {
//    this._super(el,io); var t = this;
//    // social icons
//    $(".social-icons").live("mouseenter",function() {
//      var src = $(this).attr("alt");
//      var alt = $(this).attr("src");
//      $(this).attr("src",src).attr("alt",alt);
//    });
//    $(".social-icons").live("mouseleave",function() {
//      var src = $(this).attr("alt");
//      var alt = $(this).attr("src");
//      $(this).attr("src",src).attr("alt",alt);
//    });
//    $(".social-icons").live("mousedown",function() {
//      $(this).css("top","1px");
//    });
//    $(".social-icons").live("mouseup",function() {
//      $(this).css("top","0px");
//    });
//  },
//  done:function() { this._super(); },
//   show:function(holder) { this._super(holder,null,true); },
//  hide:function() { this._super(); },
//  begin:function(id) {
//    this._super();
//    // get id if not supplied
//    if(!id) id = this.first_obj;
//    // add to doc
//    this.show("#main-top");
//    // get the desired object
//    this.io.request(this,"id="+id+"&hit=true&is_do=getObj");
//    // set global
//    Island.view = "obj";
//    // set nav
//    Island.setNav($("a#nav-"+Island.view+" > h1"));
//  },
//  clear:function() { this._super(); },
//  iHTML:function() {
//    this._super();
//    // send back
//    return "<div style='float:left;'> \
//          <div id='obj-title'></div> \
//          <div id='obj-holder'></div> \
//          <div id='obj-desc' class='matte'> \
//            <img src='gfx/is-obj-info.gif' alt='info' align='top' style='float:left;' /> \
//            <div style='margin:0 0 0 25px; padding:10px 10px 5px 4px;'> \
//              <p id='obj-desc-txt'></p> \
//              <h3 class='obj-details' id='obj-details'></h3> \
//              <div style='position:relative; height:17px;'> \
//                <img src='gfx/sn/b/facebook_16.png' class='social-icons' alt='gfx/sn/facebook_16.png' title='Post to Profile' style='left:0px;' /> \
//                <img src='gfx/sn/b/twitter_16.png' class='social-icons' alt='gfx/sn/twitter_16.png' title='Tweet' style='left:21px;' /> \
//                <img src='gfx/sn/b/myspace_16.png' class='social-icons' alt='gfx/sn/myspace_16.png' title='Post to Profile' style='left:42px;' /> \
//                <img src='gfx/sn/b/digg_16.png' class='social-icons' alt='gfx/sn/digg_16.png' title='Digg It' style='left:63px;' /> \
//                <img src='gfx/sn/b/delicious_16.png' class='social-icons' alt='gfx/sn/delicious_16.png' title='Share' style='left:84px;' /> \
//                <img src='gfx/sn/b/stumbleupon_16.png' class='social-icons' alt='gfx/sn/stumbleupon_16.png' title='Share' style='left:105px;' /> \
//                <img src='gfx/sn/b/tumblr_16.png' class='social-icons' alt='gfx/sn/tumblr_16.png' title='Share' style='left:126px;' /> \
//                <img src='gfx/sn/b/email_16.png' class='social-icons' alt='gfx/sn/email_16.png' title='Email' style='left:147px;' /> \
//                <img src='gfx/sn/b/rss_16.png' class='social-icons' alt='gfx/sn/rss_16.png' title='Follow' style='left:168px;' /> \
//              </div> \
//            </div> \
//          </div> \
//          <div id='obj-input' class='matte'> \
//            <img src='gfx/is-obj-speak.gif' alt='speak' align='top' /> \
//            <textarea name='Respond...' class='com-textarea' id='com_content' title='Your Response'>Respond...</textarea> \
//            <input type='submit' title='Add Comment' value='+ Comment' class='add-comment' /> \
//          </div> \
//        </div> \
//        <div style='margin-left:670px;'> \
//          <h1 class='side-title'>/ Comments</h1> \
//          <div id='obj-comments'></div> \
//        </div> \
//        <div class='clear'></div>";
//  },
//  receive:function(json) {
//    switch(json.did) {
//      case "got obj" :
//        // start html
//        var html = "";
//        // get heights
//        var heights = $.array_combine(json.data.obj_widths.split(","),json.data.obj_heights.split(","));
//        // determine object type
//        switch(json.data.obj_type) {
//          case "image" :
//            var source = json.data.obj_handle+"_grid_"+this.OBJ_WIDTH+".jpg";
//            html += "<img id='image-"+json.data.ID+"' src='"+source+"' alt='"+json.data.obj_type+"' width='"+this.OBJ_WIDTH+"px' height='"+heights[this.OBJ_WIDTH]+"px' style='opacity:0;' />";
//            break;
//          case "video" :
//            var source = json.data.obj_handle+".mp4";
//            html += "<a href='"+source+"' style='display:block; width:"+this.OBJ_WIDTH+"px; height:"+heights[this.OBJ_WIDTH]+"px;' id='player-"+json.data.ID+"'></a>";
//            break;
//        }
//        // get the title
//        var title = "<span class='slash'>/</span><h1 class='obj-title'>"+json.data.obj_title+"</h1>";
//        title += "<h1 class='obj-owner'>from "+json.data.obj_owner+"</h1>";
//        // write title
//        $("#obj-title").html($(title));
//        // write media
//        $("#obj-holder").html($(html));
//        // write the description
//        $("#obj-desc-txt").text(json.data.obj_desc);
//        // get the details
//        var details = "Added "+$.tsToDate(json.data.obj_time)+" by "+json.data.obj_owner;
//        // write details
//        $("#obj-details").text(details);
//        // embed swf if video
//        if(json.data.obj_type=="video") flowplayer("player-"+json.data.ID, "swf/flowplayer-3.2.3.swf", {
//          screen: { bottom:0 },
//          plugins: {
//            controls: {
//              url:"flowplayer.controls-3.2.2.swf",
//              backgroundColor:"transparent",
//              backgroundGradient:"none",
//              sliderColor:"#FFFFFF",
//              sliderBorder:"1.5px solid rgba(160,160,160,0.7)",
//              volumeSliderColor:"#FFFFFF",
//              volumeBorder:"1.5px solid rgba(160,160,160,0.7)",
//              timeColor:"#ffffff",
//              durationColor:"#535353",
//              tooltipColor:"rgba(255, 255, 255, 0.7)",
//              tooltipTextColor:"#000000"
//            }
//          },
//          clip: { autoPlay:true }
//        });
//        // show and get new grid
//        var t = this;
//        var tags = json.data.obj_tags ? json.data.obj_tags : "random";
//        // show
//        $("#image-"+json.data.ID).fadeTo("fast",1);
//        // start grid
//        Island.grid.begin(tags,json.data.ID);
//        break;
//      default :
//        console.log(json.did);
//        break;
//    }
//  },
//  stop:function() { this._super(); }
// });
// /////////////////////////////////////////////////////////////// grid : public
// var Grid = Module.extend({
//  // private vars -- object sizes: 231, 482, 640, 733
//  NUM_GRID:50, NUM_FLOW:25, GRID_OBJ_FREQ:{"482px":1,"231px":'*'}, COL_WIDTH:231, COL_GAP_X:20, COL_GAP_Y:30, MIN_COLS:2, MAX_COLS:4, x_off:0, y_off:0, col_heights:[],
//  first:true, p:0, start:0, content:"recent", dbFulltext:"obj_tags",
//    init:function(el,io) {
//    this._super(el,io); var t = this;
//    // io for object
//    t.obj_io = new IO();
//    // init object
//    t.obj = false;
//    // setup window events
//    $(window).scroll(function() { t.opacity(true); t.flow(); });
//    $(window).bind("resize",function() { t.opacity(true); });
//    // click each object
//    $(".each-obj",$(t.el)).live("click",function() {
//      t.open(this.id.substring(4));
//    });
//    // rollover each object
//    $(".each-obj").live("mouseenter",function() {
//      // show
//      $(".obj-hover",this).show();
//      // position
//      var left = $(this).width() / 2 - ($(".obj-hover-txt",this).width() + parseInt($(".obj-hover-txt",this).css("padding-left")) * 2) / 2;
//      var top = $(this).height() / 2 - ($(".obj-hover-txt",this).height() + parseInt($(".obj-hover-txt",this).css("padding-top")) * 2) / 2;
//      $(".obj-hover-txt",this).css("left",left).css("top",top);
//    });
//    $(".each-obj").live("mouseleave",function() {
//      $(".obj-hover",this).fadeOut(100);
//    });
//  },
//  done:function() { this._super(); },
//   show:function(holder) { this._super(holder,"grid",true); },
//  hide:function() { this._super(); },
//  begin:function(tags,id) {
//    this._super();
//    // clear grid
//    this.refresh();
//    // add to doc
//    if(!this.added) {
//      this.added = true;
//      this.show("#main-bottom");
//    }
//    // store tags
//    this.tags = tags;
//    this.src_id = id;
//    // lock
//    this.locked = true;
//    // get related media
//    if(this.tags) this.io.request(this,"start="+this.start+"&num="+this.NUM_GRID+"&id="+this.src_id+"&fulltext="+this.dbFulltext+"&tags="+this.tags+"&is_do=searchGrid");
//    // get recent media
//    else this.io.request(this,"start="+this.start+"&num="+this.NUM_GRID+"&is_do=getGrid");
//  },
//  clear:function() { this._super(); },
//  iHTML:function() { this._super(); },
//  receive:function(json) {
//    switch(json.did) {
//      case "got grid" : case "found objs" :
//        // clone data for later
//        var raw = $.extend(true,{},json.data);
//        // create sized media arrays
//        var all = [];
//        for(var w in this.GRID_OBJ_FREQ) {
//          if(this.GRID_OBJ_FREQ[w]!='*') {
//            if(!this.first || json.did=="found objs") continue;
//            var g = [];
//            for(var i=0;i<this.GRID_OBJ_FREQ[w];i++) g.push(json.data.shift());
//            all[w] = g;
//          } else all[w] = json.data;
//        }
//        // start html
//        var html = "";
//        // step through each object
//        for(var width in all) {
//          for(var i=0;i<all[width].length;i++) {
//            var object = {}; for(var p in all[width][i]) object[p] = all[width][i][p];
//            var heights = $.array_combine(object.obj_widths.split(","),object.obj_heights.split(","));
//            // title
//            var grid_obj_title = object.obj_title.length>30 ? object.obj_title.substring(0,30)+"..." : object.obj_title;
//            // what type of object?
//            var w = width.slice(0,-2);
//            switch(object.obj_type) {
//              case "image" :
//                var source = object.obj_handle+"_grid_"+w+".jpg";
//                html += "<div id='obj-"+object.ID+"' class='each-obj "+object.obj_type+"' style='width:"+w+"px; height:"+heights[w]+"px;'>";
//                html +=   "<span class='grid-obj-title'>"+grid_obj_title+"</span>";
//                html +=   "<a href='http://weareisland.ld/#"+object.ID+"'>";
//                html +=     "<div class='obj-hover' style='width:"+w+"px; height:"+heights[w]+"px;'><h1 class='obj-hover-txt'>"+object.obj_owner+" / "+object.obj_hits+"</h1></div>";
//                html +=     "<img id='img-"+object.ID+"' class='page"+this.p+"' src='"+source+"' alt='"+object.obj_type+"' width='"+w+"px' height='"+heights[w]+"px' />";
//                html +=   "</a>";
//                html +=   "<div style='float:right;'>";
//                html +=     "<span class='grid-tag'>tags: </span><span class='grid-obj-tags'>"+object.obj_tags+"</span>";
//                html +=   "</div>";
//                html += "</div>";
//                break;
//              case "video" :
//                var poster = object.obj_handle+"_poster_"+w+".gif";
//                html += "<div id='obj-"+object.ID+"' class='each-obj "+object.obj_type+"' style='width:"+w+"px; height:"+heights[w]+"px;'>";
//                html +=   "<span class='grid-obj-title'>"+grid_obj_title+"</span>";
//                html +=   "<a href='http://weareisland.ld/#"+object.ID+"'>";
//                html +=     "<div class='obj-hover' style='width:"+w+"px; height:"+heights[w]+"px;'><h1 class='obj-hover-txt'>"+object.obj_owner+" / "+object.obj_hits+"</h1></div>";
//                html +=     "<img id='img-"+object.ID+"' class='page"+this.p+"' src='"+poster+"' alt='"+object.obj_type+"-"+object.ID+"' width='"+w+"px' height='"+heights[w]+"px' />";
//                html +=   "</a>";
//                html +=   "<div style='float:right;'>";
//                html +=     "<span class='grid-tag'>tags: </span><span class='grid-obj-tags'>"+object.obj_tags+"</span>";
//                html +=   "</div>";
//                html += "</div>";
//                break;
//            }
//          } 
//        }
//        // only add title and wrap on first run
//        if(this.first) {
//          // not the first run anymore
//          this.first = false;
//          // add grid structure
//          var title;
//          if(json.did=="found objs") {
//            this.content = "filtered";
//            title = "<h1 class='media-title'>/ Related Media</h1>";
//          } else {
//            this.content = "recent";
//            title = "<h1 class='media-title'>/ Recent Media <a href='javascript:;' style='padding:0 0 0 5px;'><img class='rss-icon' src='gfx/is-rss.png' alt='gfx/is-rss-hover.png' title='Follow ISLAND Content' height='15'></h1>";
//          }
//          html = title+"<div id='grid'>"+html+"</div>";
//          // add to page
//          $(this.el).append($(html));
//        // add to page -- for scrolling
//        } else $("#grid").append($(html));
//        // organize page
//        this.collage();
//        // get object opacities
//        var opacity = this.opacity(false);
//        // show
//        var s = 1000;
//        for(var o in raw) {
//          $("#obj-"+raw[o].ID).fadeTo(s,opacity[o]);
//          s += 100;
//        }
//        // increment vars
//        this.start += json.data2; this.p++;
//        // unlock
//        this.locked = false;
//        break;
//      case "got obj" :
//        // start the html
//        var html = "";
//        // store data
//        var object = json.data;
//        // get widths and heights
//        var width; for(var w in this.GRID_OBJ_FREQ) if(this.GRID_OBJ_FREQ[w]=="*") width = w;
//        var heights = $.array_combine(object.obj_widths.split(','),object.obj_heights.split(','));
//        // title
//        var grid_obj_title = object.obj_title.length>30 ? object.obj_title.substring(0,30)+"..." : object.obj_title;
//        // what type of object?
//        var w = width.slice(0,-2);
//        switch(object.obj_type) {
//          case "image" :
//            var source = object.obj_handle+"_grid_"+w+".jpg";
//            html += "<div id='obj-"+object.ID+"' class='each-obj "+object.obj_type+"' style='width:"+w+"px; height:"+heights[w]+"px;'>";
//            html +=   "<span class='grid-obj-title'>"+grid_obj_title+"</span>";
//            html +=   "<a href='http://weareisland.ld/#"+object.ID+"'>";
//            html +=     "<div class='obj-hover' style='width:"+w+"px; height:"+heights[w]+"px;'><h1 class='obj-hover-txt'>"+object.obj_owner+" / "+object.obj_hits+"</h1></div>";
//            html +=     "<img id='img-"+object.ID+"' class='page"+this.p+"' src='"+source+"' alt='"+object.obj_type+"' width='"+w+"px' height='"+heights[w]+"px' />";
//            html +=   "</a>";
//            html +=   "<div style='float:right;'>";
//            html +=     "<span class='grid-tag'>tags: </span><span class='grid-obj-tags'>"+object.obj_tags+"</span>";
//            html +=   "</div>";
//            html += "</div>";
//            break;
//          case "video" :
//            var poster = object.obj_handle+"_poster_"+w+".gif";
//            html += "<div id='obj-"+object.ID+"' class='each-obj "+object.obj_type+"' style='width:"+w+"px; height:"+heights[w]+"px;'>";
//            html +=   "<span class='grid-obj-title'>"+grid_obj_title+"</span>";
//            html +=   "<a href='http://weareisland.ld/#"+object.ID+"'>";
//            html +=     "<div class='obj-hover' style='width:"+w+"px; height:"+heights[w]+"px;'><h1 class='obj-hover-txt'>"+object.obj_owner+" / "+object.obj_hits+"</h1></div>";
//            html +=     "<img id='img-"+object.ID+"' class='page"+this.p+"' src='"+poster+"' alt='"+object.obj_type+"-"+object.ID+"' width='"+w+"px' height='"+heights[w]+"px' />";
//            html +=   "</a>";
//            html +=   "<div style='float:right;'>";
//            html +=     "<span class='grid-tag'>tags: </span><span class='grid-obj-tags'>"+object.obj_tags+"</span>";
//            html +=   "</div>";
//            html += "</div>";
//            break;
//        }
//        // add to page
//        $("#grid").prepend($(html));
//        // organize page
//        this.collage();
//        // show
//        $("#obj-"+object.ID).fadeTo("fast",1);
//        break;
//      case "found none" :
//        // show title only
//        if(this.first) $(this.el).append($("<h1 class='media-title'>/ Related Media</h1><div id='grid' style='min-height:200px;'>Sorry, nothing to see here...</div>"));
//        // don't add the title again
//        this.first = false;
//        // set content type
//        this.content = "filtered";
//        // unlock
//        this.locked = false;
//        break;
//      case "empty grid" : break;
//      default : console.log(json.did); break;
//    }
//  },
//  stop:function() { this._super(); },
//  append:function(id) {
//    // get this object
//    this.io.request(this,"id="+id+"&hit=false&is_do=getObj");
//  },
//  collage:function() {
//    // determine the number of columns
//    var num_cols = Math.min(Math.max(this.MIN_COLS,(parseInt($(this.el).innerWidth())+this.COL_GAP_X)/(this.COL_WIDTH+this.COL_GAP_X)),this.MAX_COLS);
//    // clear column height array
//    for(x=0; x<num_cols; x++) this.col_heights[x] = 0;
//    // loop over each object in grid
//    var t = this;
//    $(".each-obj").each(function(i) {
//      // determine how many columns the object will span
//      var obj_col, obj_span, obj_y = 0;
//      obj_span = Math.max(Math.round($(this).outerWidth()/t.COL_WIDTH),1); obj_col = 0;
//      // determine which column to place the object in
//      for(x=0; x<num_cols-(obj_span-1); x++) obj_col = t.col_heights[x] < t.col_heights[obj_col] ? x : obj_col;
//      // determine the object's y position
//      for(var x=0; x<obj_span; x++) obj_y = Math.max(obj_y, t.col_heights[obj_col+x]);
//      // determine the new height for the effected columns
//      for(var x=0; x<obj_span; x++) t.col_heights[obj_col+x] = parseInt($(this).outerHeight())+t.COL_GAP_Y+obj_y;
//      // set the object's css position
//      $(this).css("left",obj_col*(t.COL_WIDTH+t.COL_GAP_X)+t.x_off).css("top",obj_y+t.y_off);
//    });
//    // add the column gap to the bottom of the collage
//    $(this.el).height(Math.max.apply(Math,this.col_heights)-this.COL_GAP_Y+"px");
//  },
//  flow:function() {
//    var t = this;
//    // load more
//    if($(window).scrollTop() >= 0.99*($(document).height()-$(window).height()) && !t.locked) {
//      t.locked = true;
//      if(t.tags) t.io.request(t,"start="+t.start+"&num="+t.NUM_FLOW+"&id="+t.src_id+"&fulltext="+t.dbFulltext+"&tags="+t.tags+"&is_do=searchGrid");
//      else t.io.request(t,"start="+t.start+"&num="+t.NUM_FLOW+"&is_do=getGrid");
//    }
//  },
//  opacity:function(set) {
//    var os = [];
//    // set opacity on each object
//    $(".each-obj",$(this.el)).each(function(i) {
//      var p = $(this).offset().top;
//      var h = $(this).height();
//      var w = $(window).height();
//      var s = $(window).scrollTop();
//      var o = s + w > p + h ? 1 : s + w < p ? 0 : (h - (p + h - s - w))  / h;
//      //var o = (h - (p + h - s - w))  / h;
//      if(set) $(this).css("opacity",o);
//      else os.push(o);
//    });
//    return set ? true : os;
//  },
//  refresh:function() {
//    // clear vars
//    this.first = true;
//    this.p = 0;
//    this.start = 0;
//    this.tags = false;
//    $(this.el).html("").css("height","500px");
//  },
//  open:function(id) {
//    // clear grid
//    this.refresh();
//    // destroy object if exists
//    if(this.obj!=false) this.obj.clear();
//    // create new
//    this.obj = new Obj("#m_object",this.obj_io);
//    // load it
//    this.obj.begin(id);
//  }
// });

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
  Island.twitters = ['KingJames','50cent','ladygaga'];
  Island.tweets = [];
  Island.twut = 0;
  Island.twit = function() {
   $("#twitter").hide().html(Island.tweets[Island.twut]);
   $("#twitter").fadeIn("fast");
   Island.twut++;
   if(Island.twut==Island.tweets.length) Island.twut = 0;
  };
  Island.twat = function(t) {
   Island.tweets = Island.tweets.concat(t);
   $.fisherYates(Island.tweets);
  };
  Island.tweeter = $.setIntervalObj(this,10000,Island.twit);
	
	
	
	
	
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
	
	// no submit
	//$("form").live("submit",function() { return false; });
	// focus and blur
  // $("input[type='text'], input[type='password'], textarea").live("focus",function() {
  //  $(this).css("color","#1a1a1a");
  //  if(this.nodeName!="TEXTAREA") $(this).css("font-weight","bold");
  //  if(this.value==this.name) {
  //    this.value="";
  //    if(this.id=="mem_pass") this.setAttribute('type','password');
  //  }
  // });
  // $("input[type='text'], input[type='password'], textarea").live("blur",function() {
  //  if(this.value=="" || this.value==this.name) {
  //    $(this).css("color","#b2b2b2");
  //    if(this.nodeName!="TEXTAREA") $(this).css("font-weight","normal");
  //    this.value=this.name;
  //    if(this.id=="mem_pass") this.setAttribute('type','text');
  //  } else { 
  //    $(this).css("color","#1a1a1a");
  //    if(this.nodeName!="TEXTAREA") $(this).css("font-weight","bold");
  //  }
  // });
	
  // tweets
  for (var tt in Island.twitters)
    $.tweet({
      username: Island.twitters[tt],
      callback: Island.twat
    });
  
  
  function hideFlashMessages() {
    $(this).fadeOut();
  }

  setTimeout(function() {
    $('.flash').each(hideFlashMessages);
  }, 5000);
  $('.flash').click(hideFlashMessages);
  
  
  
	
	// rss, archipelago
	$(".rss-icon, #archipelago").live("mouseenter",function() {
		var src = $(this).attr("alt");
		var alt = $(this).attr("src");
		$(this).attr("src",src).attr("alt",alt);
	});
	$(".rss-icon, #archipelago").live("mouseleave",function() {
		var src = $(this).attr("alt");
		var alt = $(this).attr("src");
		$(this).attr("src",src).attr("alt",alt);
	});
	
	$(window).scroll(function() {
		if($(this).scrollTop()>0) {
			$("#feeds").css({ opacity:0 });
			$("#menu,#feeds,.members-bar").hide();
			$("#header").css({ width:363 });
		} else if($(this).scrollTop()==0) {
			$("#header").css({ width:984 });
			$("#menu,#feeds,.members-bar").show();
			$("#feeds").css({ opacity:1 });
		}
	});


  
  $(window).load(function () {
  
  
    // position rollovers
    $('.each-grid-obj').each(function (i) {
      var hover = $('.grid-obj-hover', this)
        , text = $('.grid-obj-hover-txt', this)
        , img = $('img', this)
      ;
      
      hover.hide().css('height', img.height());

      //var left = img.width() / 2 - (text.width() + parseInt(text.css('padding-left')) * 2) / 2;
      //console.log(parseInt(text.css('padding-left')));
      //var top = img.height() / 2 - (text.height() + parseInt(text.css('padding-top')) * 2) / 2;
      //text.css('left', left).css('top', top).css('width', 'intrinsic');
    });
  
    grid($('#grid')).collage();
    
  });
  
  
  

  


  
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
    // if (this.value == this.name) 
    //   $(this).val('').css('color','#404040');
	});
	$('.commentor-input').live('blur', function () {
    if (this.value == '') {
      $(this.parentNode).hide();
      $(this.parentNode.previousElementSibling).show();
    }

    // if (this.value == '') 
    //   $(this).val(this.name).css('color','#808080');
	}).autogrow();
	
	// $('input.add-comment').live('submit', function () {
	//     
	//   });
	
	
	
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
  
  
  // $('#login').live('click', function () {
  //    //e.preventDefault(e);
  //    var parent = this.parentNode
  //      , email = $('input[name="email"]', parent)
  //      , password = $('input[name="password"]', parent)
  //      , email_txt = email.val().trim()
  //      , password_txt = password.val().trim()
  //    ;
  //    
  //    if (email_txt == '' || email_txt == 'email') {
  //      email.val('email').css('color','red');
  //      return false;
  //    }
  //    
  //    if (password_txt == '' || password_txt == 'password') {
  //      password.val('password').css('color','red');
  //      return false;
  //    }
  //    
  //    
  //    
  //    $(parent).hide();
  //   email.val('');
  //   password.val('');
  //   
  //   //$(this.parentNode.previousElementSibling).show();
  //    
  //   var params = { 
  //           d: { 
  //               email: email_txt
  //             , password: password_txt
  //           }
  //         };
  //   
  //   $.put('/sessions', params, function (data) {
  //     console.log(data);
  //     // Saved, will return JSON
  //   });
  //   
  // });
  
	
	
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
      // Saved, will return JSON
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
  
  

});







