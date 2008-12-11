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

var notifications = [];


var Util ={

    /*
     * Returns the DOM Window for the given nsIChannel
     * Thanks to mfinkle in #extdev for helping me find this one
     */
    getDOMWindow: function(aChannel) {
      var requestor = aChannel.notificationCallbacks;
      var win = requestor.getInterface(Components.interfaces.nsIDOMWindow);
      return win;
    },


   /*
    *	parseUri 1.2.1
    *	(c) 2007 Steven Levithan <stevenlevithan.com>
    *	MIT License
    */
    parseUri: function(str) {
        this.parseUri.options = {
        	strictMode: false,
        	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
        	q:   {
        		name:   "queryKey",
        		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        	},
        	parser: {
        		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        	}
        };
        
    	var	o   = this.parseUri.options,
    		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
    		uri = {},
    		i   = 14;

    	while (i--) uri[o.key[i]] = m[i] || "";

    	uri[o.q.name] = {};
    	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    		if ($1) uri[o.q.name][$1] = $2;
    	});

    	return uri;
    },
    
	/*
	 * Trim function thanks to Steve:
	 * http://blog.stevenlevithan.com/archives/faster-trim-javascript
	 */
	trim: function(str) {
		var	str = str.replace(/^\s\s*/, ''),
			ws = /\s/,
			i = str.length;
		while (ws.test(str.charAt(--i)));
		return str.slice(0, i + 1);
	},
	
	/*
	 * Finds a page with a specific URL, making a new tab if necessary
     * Returns:  tab that is focused
     */
    showTabWithUrl: function(url) {
        for (var index = 0; index < getBrowser().mTabContainer.childNodes.length; index++) {
            var currentTab = getBrowser().mTabContainer.childNodes[index];
            if (getBrowser().getBrowserAtIndex(index).contentDocument.location.href == url) {
                // Focus tab with our attribute, load url, and return it
                getBrowser().selectedTab = currentTab;
                content.document.location = url;
                return currentTab;
            }
        }

        // Tab didn't exist.
        var newTab = getBrowser().addTab(url);
        getBrowser().selectedTab = newTab;
        return newTab;
    },
    
    // Case-Insensitve equivalent of getElementsByTagName
    getChildrenByTagName: function(rootnode, tagname) {
		var treeWalker = document.createTreeWalker(
		    rootnode,
		    NodeFilter.SHOW_ELEMENT,
		    { acceptNode: function(node) { return NodeFilter.FILTER_ACCEPT; } },
		    false
		);
		var nodeList = new Array();
		var rx = new RegExp('^' + tagname + '$','i');
		while(treeWalker.nextNode()) {
			if(rx.test(treeWalker.currentNode.nodeName)) { 
				nodeList.push(treeWalker.currentNode);
			}
		}
			
        return nodeList;
    },
    
    /* 
     * answers the value for a attribute by name given for a 
     * specific element
     */
    getAttributeValue: function(element, name) {
        var rx = new RegExp('^' + name + '$','i');
        for(var i=0;i<element.attributes.length;i++) {
            if(rx.test(element.attributes[i].name)) {
                return element.attributes[i].value;
            }
        }
        return null;
    },
};