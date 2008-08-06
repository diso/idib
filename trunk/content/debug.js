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
 
 
var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                      getService(Components.interfaces.nsIPrefBranch);

var debug = prefs.getBoolPref('extensions.openid.debug');                     
 
 if (debug) {

    /*
     * Logs as debug message to Firebug if available, otherwise write to javascript console
     */
     function dump(aMessage) {
         if(aMessage == '') {
             aMessage = '(empty string)';
         } else if(aMessage == null) {
             aMessage = 'null';
         }
         
         try {
             var objects = [];
             objects.push.apply(objects, arguments);
             Firebug.Console.logFormatted(objects, TabWatcher.getContextByWindow(content.document.defaultView.wrappedJSObject));
         } catch (e) {}

         var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
         consoleService.logStringMessage(aMessage.toString());
     }

     oidDebug = new function() {
         this.restartBrowser = function() {
            var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"].getService(Components.interfaces.nsIAppStartup);
            appStartup.quit(appStartup.eAttemptQuit | appStartup.eRestart);
         }
         
         this.popLogin = function() {
             var dia = new OpenidDialog('','GET');
             dia.showLogin();
         }
     
         function _onload(evt) {
            getBrowser().removeEventListener("load", _onload, true);
            document.getElementById("openid_statusbarpanel").setAttribute("hidden", "false");
         }

        getBrowser().addEventListener("load", _onload, false);

         return this;
     }();

} else {
    function dump(aMessage) {}
}