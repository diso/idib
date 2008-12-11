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

var OpenidDialog = function(url, method) {

    this.browser_doc = null,

    this._prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefBranch);
                         
    this._method = method;
    this._url = url;
                         
    this.login = function() {
        
        if(typeof(this._method) == "undefined" || this._method == null) {
            this._method = "POST"
        }
        
        var username = this._prefs.getCharPref('extensions.openid.url');
        // yay for backwards compatibility...
        var dataString = "openid_url=" + username + "&openid_identifier=" + username;
        dump('Login into: ' + this._url + ' via: ' + this._method + ' as: ' + username);
        
        if(method=="GET") {
            loadURI(this._url + "?" + dataString);
            return;
        }

        // Post to current tab
        // POST method requests must wrap the encoded text in a MIME
        // stream
        var stringStream = Components.classes["@mozilla.org/io/string-input-stream;1"].
                           createInstance(Components.interfaces.nsIStringInputStream);
                           
        if ("data" in stringStream) // Gecko 1.9 or newer
          stringStream.data = dataString;
        else // 1.8 or older
          stringStream.setData(dataString, dataString.length);

        var postData = Components.classes["@mozilla.org/network/mime-input-stream;1"].
                       createInstance(Components.interfaces.nsIMIMEInputStream);
        postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
        postData.addContentLength = true;
        postData.setData(stringStream);
        
        loadURI(this._url, null, postData );
    }
    
    
    /*
     * Add an element to right under the tab box.
     */
    this.addUnderTab = function(element) {
        var tabBox = document.getAnonymousElementByAttribute(document.getElementById("content"), "anonid", "tabbox");
        if (tabBox == null) {
            // Firefox 1.5
            tabBox = document.getAnonymousElementByAttribute(document.getElementById("content"), "class", "plain").parentNode;
        }
        tabBox.insertBefore(element, tabBox.lastChild);
    }
    
    /*
     * Returns true if there is already a login dialog present
     */
    this.dialogPresent = function() {
        var element = document.getAnonymousElementByAttribute(document.getElementById("content"), "anonid", "login_notification");
        if(element != null && typeof(element) != 'undefined')
            return true;

        return false;
    }

    /*
     * Displays login bar underneath tabs
     */
    this.showLogin = function() {
        dump('show login');
        var me = this;
        
        if (this.dialogPresent()) {
            return;
        }
        
        var bar = document.createElement('login_notification');
        bar.browser = this.browser_doc;
        bar.events = {
            onSignIn: function(loginbar) {
                var username = me._prefs.getCharPref('extensions.openid.url');
                
                //Prompt for OpenID if user hasn't provided one in the past
                if (username.length <= 0) {
                    window.openDialog("chrome://openid/content/switch.xul", "Preferences","chrome,titlebar,toolbar,centerscreen,modal").focus();
                }
                me.login(url,method);
            },
            onSwitchOpenID: function(loginbar) {
                window.openDialog("chrome://openid/content/switch.xul", "Preferences","chrome,titlebar,toolbar,centerscreen,modal").focus();
            },
            onCancel: function(loginbar) {
            }
        };
        bar.setAttribute("anonid","login_notification");
        this.addUnderTab(bar);
    }
};