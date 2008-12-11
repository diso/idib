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

const ADD_ANTI_PHISHING_HEADER = false;
const PLUGIN_SIGNATURE = "fopenid@flock.com";

// XRDS Service Types
const XRDS_TYPES = ["http://specs.openid.net/auth/2.0/signon",
                    "http://specs.openid.net/auth/2.0/server"];

// Register some event listeners with the browser window
window.addEventListener("load", function() { Openid.onload() }, false);
window.addEventListener("unload", function() { Openid.unload() }, false);

var Openid = {
  captureHeaderXRDS: false,

  /*
   * Observer function that listens for xrds http headers
   */
  xrds_listener: {
    observe : function(aSubject, aTopic, aData) {
      dump("xrds listener observe. aTopic - " + aTopic + "\n");
      var httpChannel = aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
      if (aTopic == "http-on-examine-response") {
        Openid.headerXRDS(httpChannel);
      } else if (aTopic == "http-on-modify-request") {
        if (ADD_ANTI_PHISHING_HEADER) {
          httpChannel.setRequestHeader("X-OPENID-ANTI-PHISHING",
                                       PLUGIN_SIGNATURE,
                                       false);
        }
      }
    },

    get observerService() {
      return Components.classes["@mozilla.org/observer-service;1"]
                       .getService(Components.interfaces.nsIObserverService);
    },

    register: function() {
      this.observerService.addObserver(Openid.xrds_listener,
                                       "http-on-examine-response",
                                       false);
      this.observerService.addObserver(Openid.xrds_listener,
                                       "http-on-modify-request",
                                       false);
    },

    unregister: function() {
      this.observerService.removeObserver(Openid.xrds_listener,
                                          "http-on-examine-response");
      this.observerService.removeObserver(Openid.xrds_listener,
                                          "http-on-modify-request");
    },

    QueryInterface : function(aIID) {
      if (aIID.equals(Components.interfaces.nsISupports) ||
          aIID.equals(Components.interfaces.nsIObserver))
      {
        return this;
        throw Components.results.NS_NOINTERFACE;
      }
    },
  },

  /*
   * Checks for x-xrds-location http header
   */
  headerXRDS: function Openid_headerXRDS(httpChannel) {
    var xrdsloc = null;

    // Try all variations of capitalization
    var variations = new Array("x-xrds-location", "x-XRDS-Location",
                               "X-XRDS-LOCATION", "X-XRDS-Location");
    for each (var headerVariation in variations) {
      try {
        xrdsloc = httpChannel.getResponseHeader(headerVariation);
      } catch(e) {
        dump("headerXRDS() didn't find any headerXRDS\n");
      }
      if (xrdsloc) {
        // Exit when we find what we're looking for
        break;
      }
    }

    if (Openid.captureHeaderXRDS &&
        httpChannel.originalURI &&
        httpChannel.originalURI.spec)
    {
      FlockOpenID._validationResults[httpChannel.originalURI.spec] = xrdsloc;
      Openid.captureHeaderXRDS = false;
    }

    if (xrdsloc) {
      dump("headerXRDS() XRDS Location found at: " + xrdsloc + "\n");
      Openid.fetchXRDS(xrdsloc, null);
    }

  },

  /*
   * Checks html http-equiv header that advertise the location of the XRDS document
   */
  metaXRDS: function Openid_medtaXRDS() {
    dump("mediaXRDS()\n");
    var doc = content.document;
    var xrdsloc = null;
    var els = doc.getElementsByTagName('meta');

    for (var i = 0; i < els.length; i++) {
      var attrib = null
      try {
        attrib = els[i].attributes.getNamedItem("http-equiv").value
                                                             .toLowerCase();
        if (attrib == "x-xrds-location") {
          xrdsloc = els[i].attributes.getNamedItem("content").value
          dump("metaXRDS() XRDS Location found at " + xrdsloc);
          Openid.fetchXRDS(xrdsloc, null);
          return;
        }
      } catch (ex) {
        dump("didn't find any metaXRDS\n");
      }
    }
  },

  /*
   * Checks a login beacon and returns the status of it.
   */
  isLoggedIn: function Openid_isLoggedIn(aLoginURL) {
    var req = new XMLHttpRequest();
    req.open("GET", aLoginURL, false);
    req.send(null);
    if (req.status == 200) {
      dump("Beacon Response: " + req.responseText + "\n");
      var rx = new RegExp(/^true$/i);
      var resp = Util.trim(req.responseText);
      x = rx.test(resp);
      dump(x + "\n");
      return x;
    }
    return false;
  },

  /*
   * Fetch the XRDS file and parse it looking for services that we wish to
   * get drunk and take advantage of.
   */
   fetchXRDS: function Openid_fetchXRDS(aUrl, aCallback) {
     var login_method = null;
     var login_uri = null;

     var req = new XMLHttpRequest();
     req.open("GET", aUrl, false);
     req.send(null);

     if (req.status == 200) {
       var xrds = req.responseXML;

       // Iterate through service types until we find the ones we care about
       var services = Util.getChildrenByTagName(xrds, "service");
       for (var i = 0; i < services.length; i++) {
         var types = Util.getChildrenByTagName(services[i], "type");
         for (var k = 0; k < types.length; k++) {
           var type = Util.trim(types[k].firstChild.nodeValue);
           if (XRDS_TYPES.indexOf(type) != -1) {
             var el = Util.getChildrenByTagName(services[i], "uri")[0];
             login_uri = Util.trim(el.firstChild.nodeValue);
             login_method = Util.getAttributeValue(el, "simple:httpmethod");
             dump("fetchXRDS() Login uri = " + login_uri + "\n");
           }
         }
       }

       if (login_uri && aCallback) {
         aCallback(login_uri, login_method);
       }
     }
   },

  /*
   * Clean up when we're finished
   */
   unload: function Openid_unload() {
     window.removeEventListener("unload", function() { Openid.unload() }, false);
     this.xrds_listener.unregister();
   },

   onLocationChange: function Openid_onLocationChange(aProgress,
                                                      aRequest,
                                                      aURI)
   {
     var chromeButton = document.getElementById("fopenIDToolbarContainer");
     if (chromeButton) {
       chromeButton.removeAttribute("active");
     }
     Openid.metaXRDS();
   },

   /*
    * Run on window load
    */
    onload: function Openid_onload(evt) {
      window.removeEventListener("load", function() { Openid.onload() }, false);
      getBrowser().addProgressListener(this, CI.nsIWebProgress.NOTIFY_LOCATION);
      this.xrds_listener.register();
   }

};
