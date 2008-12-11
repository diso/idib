/*
 * Copyright 2008 Vidoop LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
//Register some event listeners with the browser window
window.addEventListener("load", function() { Openid.onload() }, false);
window.addEventListener("unload", function() { Openid.unload() }, false);
window.addEventListener("DOMContentLoaded",function(evt) { Openid.docload(evt) }, false);


//Firefox OpenID
var Openid = {

    /*
     * Observer function that listens for xrds http headers
     */
    xrds_listener: {
        observe : function(subject, topic, data) {
            var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
            if (topic == 'http-on-examine-response') {
              Openid.headerXRDS(httpChannel);

            } else if(topic == 'http-on-modify-request') {
                //Not sure if this will ever be used, but seatbelt did it so
                if(ADD_ANTI_PHISHING_HEADER) {
                    httpChannel.setRequestHeader('X-OPENID-ANTI-PHISHING', PLUGIN_SIGNATURE, false);
                }
            }
        },

        QueryInterface : function(aIID) {
            if (aIID.equals(Components.interfaces.nsISupports) ||
                aIID.equals(Components.interfaces.nsIObserver))
                return this;
                throw Components.results.NS_NOINTERFACE;
        },
    },

    /*
     * Checks for x-xrds-location http header
     */
    headerXRDS: function(httpChannel) {
          //Try all variations of capitalization
          var variations = new Array('x-xrds-location','x-XRDS-Location','X-XRDS-LOCATION','X-XRDS-Location');
          var me = this;
          var xrdsloc = null;
          
          var found = function(url,method) {
              var dia = new OpenidDialog(url,method);
              dia.browser_loc = Util.getDOMWindow(httpChannel);
              dia.showLogin();
          }
          
          for(var i=0;i<variations.length;i++) {
              try { xrdsloc = httpChannel.getResponseHeader(variations[i]); } catch(e) {}
               // Exit when we find what we're looking for
              if(xrdsloc != null) { break; }
          }

          if (xrdsloc != null) {
              dump('XRDS Location found by http headers at: ' + xrdsloc);
              Openid.fetchXRDS(xrdsloc,found);
          }
    },
     
    /*
     * Checks html http-equiv header that advertise the location of the XRDS document
     */
    metaXRDS: function() {
        var doc = content.document;
        var xrdsloc = null;
        var els = doc.getElementsByTagName('meta');
        var show = function(url,method) {
            var dia = new OpenidDialog(url,method);
            dia.showLogin();
        }
        for(var i=0; i<els.length; i++) {
            var attrib = null
            try {
                attrib = els[i].attributes.getNamedItem('http-equiv').value.toLowerCase();
                if (attrib == 'x-xrds-location') {
                    xrdsloc = els[i].attributes.getNamedItem('content').value
                    dump('XRDS Location found by http-equiv at: ' + xrdsloc);
                    Openid.fetchXRDS(xrdsloc,show);
                }
            } catch(e) {}
        }
        return null;
    },
 
    /*
     * Checks a login beacon and returns the status of it.
     */
    isLoggedIn: function(beacon_uri) {
        var req = new XMLHttpRequest();
        req.open('GET', beacon_uri, false);
        req.send(null);
        if(req.status == 200) {
            dump('Beacon Response: ' + req.responseText);
            var rx = new RegExp(/^true$/i);
            var resp = Util.trim(req.responseText);
            x = rx.test(resp);
            dump(x);
            return x;
        }
        return false;
    },
 
    /*
     * Fetch the XRDS file and parse it looking for services that we wish to
     * get drunk and take advantage of.
     */
     fetchXRDS: function(url,callback) {
         var user_beacon = null;
         var login_method = null;
         var login_uri = null;
         
         var req = new XMLHttpRequest();
         req.open('GET', url, false); 
         req.send(null);
         if(req.status == 200) {
             var xrds = req.responseXML;
         
             // Iterate through service types until we find the ones we care about
             var services = Util.getChildrenByTagName(xrds,'service');
             for(var i=0;i<services.length;i++) {
                 var types = Util.getChildrenByTagName(services[i],'type');
                 for(var k=0;k<types.length;k++) {
                     var type = Util.trim(types[k].firstChild.nodeValue);       
                     if(type == XRDS_LOGIN_ENDPOINT) {
                         
                        var el = Util.getChildrenByTagName(services[i],'uri')[0];
                        login_uri = Util.trim(el.firstChild.nodeValue);
                        login_method = Util.getAttributeValue(el,'simple:httpmethod');
                        
                        dump('LoginAnywhere via ' + login_method + ': ' + login_uri);
                        
                     } else if(type == XRDS_USER_BEACON) {
                         var el = Util.getChildrenByTagName(services[i],'uri')[0];
                         user_beacon =  Util.trim(el.firstChild.nodeValue);
                         dump('UserBeacon at: ' + user_beacon);
                     }
                 }
             } //endfor

             // Require both LoginAnywhere and Beacon services
             if ((user_beacon != null) && (login_uri != null)) {
                 dump('test 2');
                 //make sure user is not already logged in.
                 if(!this.isLoggedIn(user_beacon)) {
                     callback(login_uri,login_method);
                 }
             }
             
         }//endif
     },
 
    /*
     * Clean up when we're finished
     */
     unload: function() {
         //Cleanup
         dump('browser unloaded');
         me.observerService.removeObserver(Openid.xrds_listener, "http-on-examine-response");
         me.observerService.removeObserver(Openid.xrds_listener, "http-on-modify-request");
         window.removeEventListener("unload", function() { Openid.unload() }, false);
         window.removeEventListener("DomContentLoaded", function(evt) { Openid.docload(evt) }, false)
     },
 
     /*
      * Run on document load
      */
     docload: function(evt) {
         this.browser_doc = evt.target;
         dump('Document Loaded');
         dump('browser loaded');
         
         //Look for XRDS in html headers
         Openid.metaXRDS();
     },
 
     /*
      * Run on window load
      */ 
      onload: function(evt) {
        var me = this;
        window.removeEventListener("load", function() { Openid.onload() }, false);

          //Listen for XRDS in http headers
         this.observerService = Components.classes["@mozilla.org/observer-service;1"]
                                  .getService(Components.interfaces.nsIObserverService);
         this.observerService.addObserver(Openid.xrds_listener, "http-on-examine-response", false);
         this.observerService.addObserver(Openid.xrds_listener, "http-on-modify-request",false);
      }
      
};