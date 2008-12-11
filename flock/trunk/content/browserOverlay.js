 // BEGIN FLOCK GPL
 //
 // Copyright Flock Inc. 2005-2008
 // http://flock.com
 //
 // This file may be used under the terms of the
 // GNU General Public License Version 2 or later (the "GPL"),
 // http://www.gnu.org/licenses/gpl.html
 //
 // Software distributed under the License is distributed on an "AS IS" basis,
 // WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 // for the specific language governing rights and limitations under the
 // License.
 //
 // END FLOCK GPL

Components.utils.import("resource://fopenid/OpenIDData.jsm");

var FlockOpenID = {
  XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

  OPENIDS_DATA_PREF: "flock.openid.data",
  DEFAULT_OPENID_PROVIDER: "flock.openid.defaultID",
  SUGGESTED_OPENIDS_DATA_PREF: "flock.openid.suggested.data",

  BUNDLE_URI: "chrome://fopenid/locale/fopenid.properties",
  PROVIDER_URL_PREFIX: "flock.getOpenID.",
  PROVIDER_URL_SUFFIX: ".url",
  PREF_DONT_SHOW_LOGIN_PANEL: "flock.openid.loginPanl.dontShowAgain",

  STR_TOOLTIP_DEFAULT: "flock.toolbar.tooltip.default",
  STR_TOOLTIP_SUGGESTED_FOUND: "flock.toolbar.tooltip.suggestedFound",
  STR_TOOLTIP_LOGIN_DETECTED: "flock.toolbar.tooltip.loginDetected",

  _panelNeedsRebuild: true,
  _validationResults: {},
  _pageIsProvider: false,
  _loginFormNode: null,
  _loginInputNodeArray: [],

  ANIMATION_DURATION: 500,
  ANIMATION_IDLE: 400,
  _animationID: null,
  _animationRunning: false,

  // Define getter for the entire panel
  get defaultFavicon() {
    return document.getElementById("defaultOpenIDIcon");
  },
  get panel() {
    return document.getElementById("flockOpenIDPanel");
  },
  get loginPanel() {
    return document.getElementById("flockOpenIDLoginDiscoveryPanel");
  },
  get openIDs() {
    return document.getElementById("openIDs");
  },
  get suggestedOpenIDs() {
    return document.getElementById("suggestedOpenIDs");
  }
};

FlockOpenID.getWD =
function FlockOpenID_getWD() {
  if (!this._wd) {
    this._wd = CC["@flock.com/web-detective;1"]
               .getService(CI.flockIWebDetective);
    this._wd.loadFromChrome("chrome://fopenid/content/fopenid.xml");
  }
  return this._wd;
};

FlockOpenID.getJSON =
function FlockOpenID_getJSON() {
  if (!this._JSON) {
    this._JSON = CC["@mozilla.org/dom/json;1"]
                 .createInstance(CI.nsIJSON);
  }
  return this._JSON;
};

FlockOpenID.getLogger =
function FlockOpenID_getLogger() {
  if (!this._logger) {
    this._logger = CC["@flock.com/logger;1"]
                   .createInstance(CI.flockILogger);
    this._logger.init("FlockOpenID");
  }
  return this._logger;
};

FlockOpenID.getPrefs =
function FlockOpenID_getPrefs() {
  if (!this._prefs) {
    this._prefs = CC["@mozilla.org/preferences-service;1"]
                  .getService(CI.nsIPrefBranch);
  }
  return this._prefs;
};

FlockOpenID.getObserverService =
function FlockOpenID_getObserverService() {
  if (!this._os) {
    this._os = CC["@mozilla.org/observer-service;1"]
               .getService(CI.nsIObserverService);
  }
  return this._os;
};

FlockOpenID.getBundle =
function FlockOpenID_getBundle() {
  if (!this._bundle) {
    this._bundle = Cc["@mozilla.org/intl/stringbundle;1"]
                   .getService(Ci.nsIStringBundleService)
                   .createBundle(this.BUNDLE_URI);
  }
  return this._bundle;
};

FlockOpenID.getProviderData =
function FlockOpenID_getProviderData() {
  if (!this._providerData) {
    var jsonString = this.getWD().getLocalizedString("fopenid",
                                                     "knownProvidersData",
                                                     null);
    this._providerData = this.getJSON().decode(jsonString);
  }
  return this._providerData;
};

FlockOpenID.showPanel =
function FlockOpenID_showPanel(aPanel, aAnchorElement, aPosition) {
  var panel;
  switch (aPanel) {
    case "login":
      panel = this.loginPanel;
      break;

    default:
      panel = this.panel;
      break;
  }
  // Display popup
  panel.popupBoxObject
       .setConsumeRollupEvent(CI.nsIPopupBoxObject.ROLLUP_CONSUME);
  panel.openPopup(aAnchorElement, aPosition, -1, -1);
};

FlockOpenID.hidePanel =
function FlockOpenID_hidePanel() {
  this.panel.hidePopup();
};

FlockOpenID.drawPanel =
function FlockOpenID_drawPanel() {
  if (!this._panelNeedsRebuild) {
    return;
  }

  var providerData = this.getProviderData();

  // Clean up the existing nodes
  while (this.openIDs.childNodes.length > 0) {
    this.openIDs.removeChild(this.openIDs.lastChild);
  }

  // Popuplate the OpenIDs
  var openIDs = this.sortOpenIDs(OpenIDData.getOpenIDs(), "provider");
  for each (var item in openIDs) {
    var displayName = (item.provider)
                    ? providerData[item.provider].displayName
                    : item.id;
    var openIDItem = document.createElementNS(this.XUL_NS, "openidProvider");
    openIDItem.setAttribute("_id", item.id);
    openIDItem.setAttribute("displayName", displayName);
    openIDItem.setAttribute("provider", (item.provider) ? item.provider : "");
    openIDItem.setAttribute("handle", (item.userid) ? item.userid : "");
    openIDItem.setAttribute("isConfigured", "true");
    this.openIDs.appendChild(openIDItem);
  }

  // Update the OpenIDs deck state
  var openIDsDeck = document.getElementById("openIDsDeck");
  if (openIDsDeck) {
    openIDsDeck.selectedIndex = (!openIDs || openIDs.length == 0) ? 0 : 1;
  }

  // Clean up the existing nodes
  while (this.suggestedOpenIDs.childNodes.length > 0) {
    this.suggestedOpenIDs.removeChild(this.suggestedOpenIDs.lastChild);
  }
  // Populate Suggested OpenIDs
  var suggestedList = this.sortOpenIDs(OpenIDData.getSuggested(), "id");
  for each (var item in suggestedList) {
    var suggestedOpenID = document.createElementNS(this.XUL_NS,
                                                   "openidProvider");

    // For Suggested the id is the provider so that no duplicates occur
    var provider = item.id;
    suggestedOpenID.setAttribute("_id", provider);
    suggestedOpenID.setAttribute("provider", provider);
    suggestedOpenID.setAttribute("displayName",
                                 providerData[provider].displayName);

    // TODO: If the account was detected from the password manager auto suggest
    // the respective handle when creating the account
    suggestedOpenID.setAttribute("handle", "");
    suggestedOpenID.setAttribute("isConfigured", "false");
    this.suggestedOpenIDs.appendChild(suggestedOpenID);
  }

  // Update the Suggested OpenIDs deck state
  var configuredDeck = document.getElementById("configuredDeck");
  if (configuredDeck) {
    configuredDeck.selectedIndex = (!suggestedList || suggestedList.length == 0)
                                 ? 0
                                 : 1;
  }

  this._panelNeedsRebuild = false;
};

FlockOpenID.toggleSection =
function FlockOpenID_toggleSection(aLabel) {
  var className = (aLabel.getAttribute("class") == "sectionExpanded")
                ? "sectionCollapsed"
                : "sectionExpanded";
  aLabel.setAttribute("class", className);
};

FlockOpenID.isNodeTextbox =
function FlockOpenID_isNodeTextbox(aNode) {
  if (aNode.nodeName == "textbox" || aNode.nodeName == "xul:textbox") {
    return true;
  }
  return false;
};

FlockOpenID.focusGetOpenID =
function FlockOpenID_focusGetOpenID(aEvent, aString) {
  var textbox = aEvent.target;
  if (!this.isNodeTextbox(textbox)) {
    return;
  }
  if (textbox.value == aString) {
    textbox.removeAttribute("helperText");
    textbox.value = "";
  }
};

FlockOpenID.blurGetOpenID =
function FlockOpenID_blurGetOpenID(aEvent, aString) {
  var textbox = aEvent.target;
  if (!this.isNodeTextbox(textbox)) {
    return;
  }
  if (textbox.value == "") {
    textbox.value = aString;
    textbox.setAttribute("helperText", "true");
  }
};

FlockOpenID.openUrl =
function FlockOpenID_openUrl(aService, aEvent) {
  if (aEvent.button == 2) {
    // Right click
    return;
  }

  var wm = CC["@mozilla.org/appshell/window-mediator;1"]
           .getService(CI.nsIWindowMediator);
  var win = wm.getMostRecentWindow("navigator:browser");
  if (win) {
    var propName = this.PROVIDER_URL_PREFIX
                 + aService
                 + this.PROVIDER_URL_SUFFIX;
    var url = this.getBundle().GetStringFromName(propName);
    if (url) {
      // Open the URL in a new tab
      win.openUILinkIn(url, "tab");
    }
  }
};

FlockOpenID.observer = {
  notify: function FlockOpenID_notify(aFormElement, aWindow, aActionURI) {
    for each (var element in aFormElement.elements) {
      if ((element.name && element.name.match(/.*openid_url.*/)) ||
          (element.id && element.id.match(/.*openid_url.*/)))
      {
        var openID = element.value;
        OpenIDData.addOpenID({id: openID},
                              FlockOpenID.OPENIDS_DATA_PREF);
        var doc = aFormElement.ownerDocument
                  .QueryInterface(CI.nsIDOMHTMLDocument);

        // Add the history to the respective openID
        OpenIDData.addHistory(openID, doc.URL);

        // Update the last login value
        OpenIDData.setLastLoginOpenIDForDomain(doc.domain, openID);

        // Panel needs rebuild to refresh history
        FlockOpenID._panelNeedsRebuild = true;
        break;
      }
    }
  },

  observe: function FlockOpenID_observe(aSubject, aTopic, aData) {
    if (aTopic == "FlockDocumentReady") {
      FlockOpenID.detectOpenID(true);
    }
  },

  QueryInterface: function FlockOpenID_QueryInterface(aIID) {
    if (aIID.equals(CI.nsISupports) ||
        aIID.equals(CI.nsIObserver) ||
        aIID.equals(CI.nsIFormSubmitObserver))
    {
      return this;
    }
    throw CR.NS_ERROR_NO_INTERFACE;
  }
};

FlockOpenID.addManualOpenID =
function FlockOpenID_addManualOpenID() {
  var openIDTextbox = document.getElementById("enterOpenID");
  var url = openIDTextbox.value;
  this.getLogger().info("addManualOpenID(): url = " + url);
  this.createOpenIDFromSuggestedID("", url, "");

  // Clear the textbox and reset the state of the deck
  openIDTextbox.value = "";
  document.getElementById("enterOpenIDDeck").selectedIndex = 0;
  document.getElementById("validatingLoader").setAttribute("hide", "true");
  document.getElementById("validatingSuccessMsg").setAttribute("hide", "true");
};

FlockOpenID.createOpenIDFromSuggestedID =
function FlockOpenID_createOpenIDFromSuggestedID(aID, aValidatedURL, aUserid) {
  this.getLogger().info("createOpenIDFromSuggestedID(): ID = " + aID);

  // First remove from the suggested list
  if (aID) {
    OpenIDData.deleteID(aID, this.SUGGESTED_OPENIDS_DATA_PREF);
  }

  // Add to the list of confirmed OpenIDs
  OpenIDData.addOpenID({ id: aValidatedURL, userid: aUserid, provider: aID },
                       this.OPENIDS_DATA_PREF);

  if (!this.isDefaultOpenIDSet()) {
    // If no default has been specified, make this the default
    this.setDefaultOpenID(aValidatedURL);
    this.setFavIconFromProvider(aID);
  }

  // Update the UI
  this._panelNeedsRebuild = true;
  this.drawPanel();
};

FlockOpenID.initDefaultOpenIDIcon =
function FlockOpenID_initDefaultOpenIDIcon() {
  var openIDList = OpenIDData.getOpenIDs();
  var provider = null;
  for each (var item in openIDList) {
    if (item.id && item.provider && FlockOpenID.isDefaultOpenID(item.id)) {
      provider = item.provider;
      break;
    }
  }
  FlockOpenID.setFavIconFromProvider(provider);
};

FlockOpenID.setFavIconFromProvider =
function FlockOpenOD_setFaviIconFromProvider(aProvider) {
  var providerData = FlockOpenID.getProviderData();
  var iconSrc = (aProvider && providerData[aProvider])
              ? providerData[aProvider].favicon
              : null;
  var defaultContainerClassName = "hide";

  if (iconSrc) {
    defaultContainerClassName = "show";
    FlockOpenID.defaultFavicon.setAttribute("src", iconSrc);
    FlockOpenID.getLogger()
               .info("setFavIconFromProvider() icon src = " + iconSrc);
  }

  document.getElementById("defaultOpenIDContainer")
          .setAttribute("class", defaultContainerClassName);
};

FlockOpenID.isDefaultOpenIDSet =
function FlockOpenID_isDefaultOpenIDSet() {
  var prefs = this.getPrefs();
  // If no default has been set, or the default is a blank string
  if (!prefs.getPrefType(FlockOpenID.DEFAULT_OPENID_PROVIDER) ||
      (prefs.getPrefType(FlockOpenID.DEFAULT_OPENID_PROVIDER) &&
       prefs.getCharPref(FlockOpenID.DEFAULT_OPENID_PROVIDER) == ""))
  {
    return false;
  }
  return true;
};

FlockOpenID.setDefaultOpenID =
function FlockOpenID_setDefaultOpenID(aID) {
  this.getLogger().info("setDefaultOpenID(): set to ID = " + aID);

  // Set the preference
  this.getPrefs().setCharPref(this.DEFAULT_OPENID_PROVIDER, aID);

  this.refreshDefaultFavIconState();

  // If we are on a page that supports OpenID logins, prefill the document's
  // input with the new default value
  this.detectOpenID(false);

  // Panel rebuild needed to float the default OpenID to the top
  this._panelNeedsRebuild = true;
};


FlockOpenID.sortOpenIDs =
function FlockOpenID_sortOpenIDs(aOpenIDArray, aEvalProperty) {
  if (!aOpenIDArray) {
    return [];
  }

  // Alphabetical sort
  function _alphaSort(aA, aB) {
    var providerA = eval("aA." + aEvalProperty).toLowerCase();
    var providerB = eval("aB." + aEvalProperty).toLowerCase();
    if (providerA < providerB) {
      return -1;
    } else if (providerA > providerB) {
      return 1;
    }
    return 0;
  }
  aOpenIDArray.sort(_alphaSort);

  // Position the default in first position
  for (var i in aOpenIDArray) {
    var openID = aOpenIDArray[i];
    if (openID.id && this.isDefaultOpenID(openID.id)) {
      aOpenIDArray.splice(i, 1);
      aOpenIDArray.unshift(openID);
      break;
    }
  }

  return aOpenIDArray;
};

FlockOpenID.refreshDefaultFavIconState =
function FlockOpenID_refreshDefaultFavIconState() {
  // Refresh the default state of all OpenIDs
  var provider = null;
  for (var i = 0; i < this.openIDs.childNodes.length; i++) {
    var openID = this.openIDs.childNodes[i];
    var id = openID.getAttribute("_id");
    var isDefault = this.isDefaultOpenID(id);
    openID.setDefaultState(isDefault);
    if (isDefault) {
      provider = openID.getAttribute("provider");
    }
  }
  this.setFavIconFromProvider(provider);
};

FlockOpenID.isDefaultOpenID =
function FlockOpenID_isDefaultOpenID(aID) {
  var prefs = this.getPrefs();
  if (prefs.getPrefType(FlockOpenID.DEFAULT_OPENID_PROVIDER) &&
      prefs.getCharPref(FlockOpenID.DEFAULT_OPENID_PROVIDER) == aID)
  {
    return true;
  }
  return false;
};

FlockOpenID.deleteOpenID =
function FlockOpenID_deleteOpenID(aID) {
  this.getLogger().info("deleteOpenID(): delete ID = " + aID);

  OpenIDData.deleteID(aID, this.OPENIDS_DATA_PREF);

  // Check if we need to set a new default pref
  if (this.isDefaultOpenID(aID)) {
    var newDefaultPref = "";
    var openIDs = OpenIDData.getOpenIDs();
    if (openIDs && openIDs.length > 0 && openIDs[0].id) {
      newDefaultPref = openIDs[0].id;
    }
    this.setDefaultOpenID(newDefaultPref);
  }

  // Redraw the panel
  this._panelNeedsRebuild = true;
  this.drawPanel();
  this.refreshDefaultFavIconState();
};

FlockOpenID.isValidURL =
function FlockOpenID_isValidURL(aURL) {
  var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  return regexp.test(aURL);
};

FlockOpenID.validateManualOpenID =
function FlockOpenID_validateManualOpenID() {
  var enterOpenIDDeck = document.getElementById("enterOpenIDDeck");
  var enterOpenIDTextbox = document.getElementById("enterOpenID");
  var errorBox = document.getElementById("errorBox");
  var errorMsgText = document.getElementById("errorMsgText");
  var bundle = this.getBundle();

  if (!enterOpenIDTextbox.value ||
      enterOpenIDTextbox.value.length == 0 ||
      !this.isValidURL(enterOpenIDTextbox.value))
  { 
    var errorLabel = bundle.GetStringFromName("flock.validate.error.url");
    errorMsgText.setAttribute("value", errorLabel);
    errorBox.setAttribute("error", "true");
    return;
  }

  var loader = document.getElementById("validatingLoader");
  var successMsg = document.getElementById("validatingSuccessMsg");

  // Show the validating screen
  loader.removeAttribute("hide");
  enterOpenIDDeck.selectedIndex = 1;

  var inst = this;
  var validationListener = {
    onResult: function validateProvider_OnResult(aLocation) {
      inst.getLogger().info("validateManualOpenID() Location = " + aLocation);
      successMsg.removeAttribute("hide");
      errorBox.removeAttribute("error");
      var selectedIndex;
      if (aLocation) {
        if (errorBox.hasAttribute("error")) {
          errorBox.removeAttribute("error");
        }
        // Show the success message
        successMsg.removeAttribute("hide");
        selectedIndex = 2;
      } else {
        var errorLabel =
          bundle.GetStringFromName("flock.validate.error.tryAgain");
        errorMsgText.setAttribute("value", errorLabel);
        errorBox.setAttribute("error", "true");
        successMsg.setAttribute("hide", "true");
        selectedIndex = 0;
      }
      enterOpenIDDeck.selectedIndex = selectedIndex;
    }
  };
  this.validateOpenID(enterOpenIDTextbox.value,
                      validationListener);
};

FlockOpenID.loginRadioSelect =
function FlockOpenID_loginRadioSelect(aNode) {
  if (aNode && aNode.getAttribute("openID")) {
    this.formFill(this._loginInputNodeArray, aNode.getAttribute("openID"));
  }
};

FlockOpenID.drawLoginDiscoveryPanel =
function FlockOpenID_drawLoginDiscoveryPanel() {
  var radioGroup = document.getElementById("openIDLoginRadio");
  while (radioGroup.childNodes.length > 0) {
    radioGroup.removeChild(radioGroup.lastChild);
  }

  var doc = gBrowser.selectedBrowser.contentDocument;
  var lastUsedOpenID = null;
  if (doc && doc.domain) {
    // Check to see if the user has a preference for which openID they use
    // for this domain
    lastUsedOpenID = OpenIDData.getLastLoginOpenIDForDomain(doc.domain);
  }

  var providerData = this.getProviderData();
  var openIDs = this.sortOpenIDs(OpenIDData.getOpenIDs(), "provider");
  for each (var item in openIDs) {
    var displayName;
    var favicon;
    if (item.provider) {
      displayName = providerData[item.provider].displayName;
      favicon = providerData[item.provider].favicon;
    } else {
      displayName = item.id;
      favicon = this.getWD().getLocalizedString("fopenid",
                                                "defaultFavicon",
                                                null);
    }

    if (item.userid) {
      // Append handle if available
      displayName += " " + item.userid;
    }

    var radioContainer = document.createElementNS(this.XUL_NS, "hbox");
    radioContainer.setAttribute("class", "radioContainer");

    var faviconImage = document.createElementNS(this.XUL_NS, "image");
    faviconImage.setAttribute("src", favicon);

    var openIDRadio = document.createElementNS(this.XUL_NS, "radio");
    openIDRadio.setAttribute("label", displayName);
    openIDRadio.setAttribute("openID", item.id);
    openIDRadio.setAttribute("onclick", "FlockOpenID.loginRadioSelect(this);");

    if ((lastUsedOpenID && lastUsedOpenID == item.id) ||
        (!lastUsedOpenID && this.isDefaultOpenID(item.id)))
    {
      openIDRadio.setAttribute("selected", "true");
    }

    radioContainer.appendChild(faviconImage);
    radioContainer.appendChild(openIDRadio);
    radioGroup.appendChild(radioContainer);
  }
};

FlockOpenID.submitLoginForm =
function FlockOpenID_submitLoginForm() {
  if (this._loginFormNode) {
    // Hide the panel
    this.loginPanel.hidePopup();
    try {
      this._loginFormNode.submit();
    } catch (ex) {
      // Unable to submit the form
    }
  }
};

FlockOpenID.findLoginForm =
function FlockOpenID_findLoginForm(aNode) {
  var prefs = this.getPrefs();
  if (prefs.getPrefType(this.PREF_DONT_SHOW_LOGIN_PANEL) &&
      prefs.getBoolPref(this.PREF_DONT_SHOW_LOGIN_PANEL))
  {
    return;
  }

  while (aNode) {
    if (aNode.nodeName.toLowerCase() == "form") {
      this.getLogger().info("findLoginForm() form found");
      this._loginFormNode = aNode;

      // Reset the checkbox state if it has changed
      this.initDontShowAgainCheckbox();
      this.showPanel("login",
                     document.getElementById("urlbar-button-openid"),
                     "after_start");
      break;
    }
    aNode = aNode.parentNode;
  }
};

FlockOpenID.formFill =
function FlockOpenID_formFill(aInputArray, aValue) {
  if (aInputArray && aInputArray.length > 0) {
    for (var i = 0; i < aInputArray.length; i++) {
      var type = aInputArray[i].getAttribute("type");
      if (type && type == "hidden") {
        // Do not set hidden input fields
        continue;
      }
      aInputArray[i].setAttribute("value", aValue);
      aInputArray[i].value = aValue;
    }
  }
};

FlockOpenID.lightUpChrome =
function FlockOpenID_lightUpChrome(aDomain, aInputArray, aShowLoginPanel) {
  this.getLogger().info("lightUpChrome()");
  document.getElementById("fopenIDToolbarContainer")
          .setAttribute("active", "true");

  function pulseFadeOut() {
    this._animationID = setTimeout(
      function lightUpChromeAnimateOut() {
        var callbackFunction = (FlockOpenID._animationRunning)
                             ? pulseFadeIn
                             : null;
        $("#fopenIDToolbarContainer").fadeTo(FlockOpenID.ANIMATION_DURATION,
                                             0.65,
                                             callbackFunction);
      }, FlockOpenID.ANIMATION_IDLE);
  }

  function pulseFadeIn() {
    this._animationID = setTimeout(
      function lightUpChromeAnimateIn() {
        var callbackFunction = (FlockOpenID._animationRunning)
                             ? pulseFadeOut
                             : null;
        $("#fopenIDToolbarContainer").fadeTo(FlockOpenID.ANIMATION_DURATION,
                                             1.0,
                                             callbackFunction);
      }, FlockOpenID.ANIMATION_IDLE);
  }

  if (!this._animationRunning) {
    pulseFadeIn();
    this._animationRunning = true;
  }

  // Pre-populate the openID field with the default
  var prefs = this.getPrefs();
  if (aInputArray && aInputArray.length > 0 &&
      prefs.getPrefType(FlockOpenID.DEFAULT_OPENID_PROVIDER))
  {
    var defaultOpenID =
      prefs.getCharPref(FlockOpenID.DEFAULT_OPENID_PROVIDER);

    if (aDomain) {
      // Check to see if the user has logged into this domain before
      var lastUsedOpenID = OpenIDData.getLastLoginOpenIDForDomain(aDomain);
      if (lastUsedOpenID) {
        defaultOpenID = lastUsedOpenID;
      }
    }

    this._loginInputNodeArray = aInputArray;
    this.formFill(aInputArray, defaultOpenID);
    if (aShowLoginPanel && defaultOpenID && defaultOpenID.length > 0) {
      this.findLoginForm(aInputArray[0]);
    }
  }

  // Populate the main button with helper tooltiptext
  var toolbarButton = document.getElementById("fopenIDToolbarContainer");
  var bundle = this.getBundle();
  var tooltipText;
  // The login detection takes priority here, if a site is a provider and has
  // a detected OpenID login field, display the login tooltip
  if (this._pageIsProvider && (!aInputArray || aInputArray.length == 0)) {
    tooltipText = bundle.GetStringFromName(this.STR_TOOLTIP_SUGGESTED_FOUND);
  } else {
    tooltipText = bundle.GetStringFromName(this.STR_TOOLTIP_LOGIN_DETECTED);
  }
  toolbarButton.setAttribute("tooltiptext", tooltipText);
};

FlockOpenID.resetChrome =
function FlockOpenID_resetChrome() {
  this.getLogger().info("resetChrome()");

  // Clear form data references
  this._loginInputNodeArray = [];
  this._loginFormNode = null;
  this.loginPanel.hidePopup();

  if (this._animationRunning) {
    clearTimeout(this._animationID);
    this._animationID = null;
    this._animationRunning = false;
  }

  var toolbarButton = document.getElementById("fopenIDToolbarContainer");
  toolbarButton.removeAttribute("active");
  toolbarButton.style.opacity = 1;

  // Set the default tooltip
  var defaultTooltip =
    this.getBundle().GetStringFromName(this.STR_TOOLTIP_DEFAULT);
  toolbarButton.setAttribute("tooltiptext", defaultTooltip);
};

FlockOpenID.validateOpenID =
function FlockOpenID_validateOpenID(aURL, aValidationListener) {
  this.getLogger().info("validateOpenID(): for URL " + aURL);

  // Capture any x-xrds-location http headers
  Openid.captureHeaderXRDS = true;

  var inst = this;

  // Http channel listener
  var channelListener = {
    _pageSource: null,

    onStartRequest: function (aRequest, aContext) {
      this._pageSource = "";
    },

    onDataAvailable: function (aRequest, aContext, aStream,
                               aSourceOffset, aLength) {
      // Convert the stream into data which can be scrapped, the stream will
      // be coming in chunks thus append the contents into a private member
      var scriptableInputStream = CC["@mozilla.org/scriptableinputstream;1"]
                                  .createInstance(CI.nsIScriptableInputStream);
      scriptableInputStream.init(aStream);
      this._pageSource += scriptableInputStream.read(aLength);
    },

    onStopRequest: function (aRequest, aContext, aStatus) {
      var openIDLocation = null;
      if (inst._validationResults && inst._validationResults[aURL]) {
        // If the OpenID has been validated via request headers there is no
        // need to scrape for secondary detection possibilities
        inst.getLogger().info("validateOpenID(): found via http headers");
        openIDLocation = inst._validationResults[aURL];
      } else if (this._pageSource) {
        // The response headers have been parsed at this point, if an OpenID URI
        // has not been found then scan the document for:
        // <link rel="openid2.provider" href="X"/>
        // <link rel="openid.server" href="X"/>
        // <link rel="openid2.provider opened.server" href="X"/>
        var regExp = "link rel=['|\"]openid(.+)['|\"] href=['|\"](.+)['|\"]";
        regExp = new RegExp(regExp);
        var scrapeResults = regExp.exec(this._pageSource);
        if (scrapeResults && scrapeResults.length >= 3) {
          inst.getLogger().info("validateOpenID(): found via page scrape");
          openIDLocation = scrapeResults[2];
        }
      }
      aValidationListener.onResult(openIDLocation);
    },

    getInterface: function (aIID) {
      try {
        return this.QueryInterface(aIID);
      } catch (aEx) {
        throw Components.results.NS_NOINTERFACE;
      }
    },

    QueryInterface : function(aIID) {
      if (aIID.equals(Components.interfaces.nsISupports) ||
          aIID.equals(Components.interfaces.nsIInterfaceRequestor) ||
          aIID.equals(Components.interfaces.nsIChannelEventSink) || 
          aIID.equals(Components.interfaces.nsIProgressEventSink) ||
          aIID.equals(Components.interfaces.nsIHttpEventSink) ||
          aIID.equals(Components.interfaces.nsIStreamListener))
        return this;
  
      throw Components.results.NS_NOINTERFACE;
    }
  };

  var ioService = CC["@mozilla.org/network/io-service;1"]
                  .getService(CI.nsIIOService);
  var uri = ioService.newURI(aURL, null, null);
  var httpChannel = ioService.newChannelFromURI(uri);
  httpChannel.asyncOpen(channelListener, null);
};

FlockOpenID.isProviderValidatedOpenID =
function FlockOpenID_isProviderValidatedOpenID(aProvider) {
  var openIDs = OpenIDData.getOpenIDs();
  for each (var item in openIDs) {
    if (item.provider && item.provider == aProvider) {
      return true;
    }
  }
  return false;
};

FlockOpenID.checkForSuggestedOpenIDs =
function FlockOpenID_checkForSuggestedOpenIDs(aHost) {
  this._pageIsProvider = false;
  var providerData = this.getProviderData();
  var providerIsOpenID;

  for (var provider in providerData) {
    providerIsOpenID = this.isProviderValidatedOpenID(provider);

    var domains = providerData[provider].domains.split(",");
    for (var i = 0; i < domains.length; i++) {
      if (aHost.indexOf(domains[i]) != -1) {
        this._pageIsProvider = true;
        this.lightUpChrome(domains[i], [], false);
        // Only suggest if it this provider has not been added to the OpenIDs
        if (!providerIsOpenID) {
          this.getLogger().info("Suggested OpenID found for " + provider);
          // Since we only want 1 suggested OpenID for each service, use the
          // service provider as the unique key
          OpenIDData.addOpenID({id: provider},
                                FlockOpenID.SUGGESTED_OPENIDS_DATA_PREF);
          this._panelNeedsRebuild = true;
        }
      }
    }
  }
};

FlockOpenID.scanLoginManagerForSuggestedOpenIDs =
function FlockOpenID_scanLoginManagerForSuggestedOpenIDs() {
  this.getLogger().info("scanLoginManagerForSuggestedOpenIDs()");

  // Search for any accounts that are also OpenID providers, this is a
  // discovery feature for the Suggested OpenIDs
  var loginManager = CC["@mozilla.org/login-manager;1"]
                     .getService(CI.nsILoginManager);

  var providerData = this.getProviderData();
  for (var provider in providerData) {
    var domains = providerData[provider].domains.split(",");
    for (var i = 0; i < domains.length; i++) {
      var logins = loginManager.findLogins({}, domains[i], "", null);
      for each (var login in logins) {
        if (login.username) {
          this.getLogger().info("scanLoginManagerForSuggestedOpenIDs() for "
                              + provider + " with userid = " + login.username);
          // Here we can also suggest a default userid for the user
          OpenIDData.addOpenID({id: provider, userid: login.username},
                                FlockOpenID.SUGGESTED_OPENIDS_DATA_PREF);
          this._panelNeedsRebuild = true;
        }
      }
    }
  }
};

/**
 * Detect if an OpenID login field is found on the document in question
 * @param aShowLoginPanel: Boolean override to display the login discovery
 *                         panel if a login field is found
 */
FlockOpenID.detectOpenID =
function FlockOpenID_detectOpenID(aShowLoginPanel) {
  var doc = gBrowser.selectedBrowser.contentDocument;
  if (doc && doc instanceof CI.nsIDOMHTMLDocument) {
    // Detect if we've got an openID field in the page
    var webDic = this.getWD();
    var detectedInputs = [];

    if (webDic.detect("fopenid", "openID_detect", doc, null)) {
      var xPath = FlockOpenID.getWD()
                             .getLocalizedString("fopenid",
                                                 "openID_xPath",
                                                 null);
      var results = doc.evaluate(xPath, doc, null,
                                 CI.nsIDOMXPathResult.ANY_TYPE, null);
      if (results) {
        var node;
        while (node = results.iterateNext()) {
         detectedInputs.push(node);
       }
      }
    } else if (webDic.detect("fopenid", "oidurl_detect", doc, null)) {
      detectedInputs.push(doc.getElementById("oidurl"));
    }

    if (detectedInputs.length > 0 || FlockOpenID._pageIsProvider) {
      var domain = (doc.domain) ? doc.domain : null;
      this.lightUpChrome(domain, detectedInputs, aShowLoginPanel);
      return;
    }
  }
  this.resetChrome();
};

/**
 * Initialize the state of the "Don't show again" checkbox
 */
FlockOpenID.initDontShowAgainCheckbox =
function FlockOpenID_initDontShowAgainCheckbox() {
  var prefs = this.getPrefs();
  var checked = false;
  if (prefs.getPrefType(this.PREF_DONT_SHOW_LOGIN_PANEL) &&
      prefs.getBoolPref(this.PREF_DONT_SHOW_LOGIN_PANEL))
  {
    checked = true;
  }
  document.getElementById("dontShowLoginDiscovery")
          .setAttribute("checked", checked);
};

/**
 * Toggle the "Don't show again" checkbox based on the checkbox value
 * @param aCheckbox: DOM Checkbox
 */
FlockOpenID.toggleDontShowAgainCheckbox =
function FlockOpenID_toggleDontShowAgainCheckbox(aCheckbox) {
  if (aCheckbox) {
    this.getPrefs().setBoolPref(this.PREF_DONT_SHOW_LOGIN_PANEL,
                                !aCheckbox.checked);
  }
};

/**
 * void onLocationChange(in nsIWebProgress aProgress,
 *                       in nsIRequest aRequest,
 *                       in nsIURI aURI);
 * @see nsIWebProgressListener#onLocationChange
 */
FlockOpenID.onLocationChange =
function FlockOpenID_onLocationChange(aProgress, aRequest, aURI) {
  FlockOpenID.checkForSuggestedOpenIDs(aURI.spec);
  if (!aRequest) {
    // No request occurs when we are switching tabs
    FlockOpenID.detectOpenID(true);
  }
};

FlockOpenID.onLoad =
function FlockOpenID_onLoad() {
  FlockOpenID.enterOpenIDString =
    FlockOpenID.getBundle().GetStringFromName("flock.getOpenID.textbox.helperText");

  FlockOpenID.enterUserIDString =
    FlockOpenID.getBundle()
               .GetStringFromName("flock.configureSuggested.textbox.helperText");

  // Set the default OpenID favicon
  FlockOpenID.initDefaultOpenIDIcon();

  FlockOpenID.initDontShowAgainCheckbox();

  // Check to see if we can add any suggested account for the user
  FlockOpenID.scanLoginManagerForSuggestedOpenIDs();

  var obs = CC["@mozilla.org/observer-service;1"]
            .getService(CI.nsIObserverService);
  obs.addObserver(FlockOpenID.observer, "FlockDocumentReady", false);
  obs.addObserver(FlockOpenID.observer, "earlyformsubmit", false);

  var browser = getBrowser();
  browser.addProgressListener(FlockOpenID, CI.nsIWebProgress.NOTIFY_LOCATION);
};

FlockOpenID.onUnLoad =
function FlockOpenID_onUnLoad() {
  var obs = CC["@mozilla.org/observer-service;1"]
            .getService(CI.nsIObserverService);
  obs.removeObserver(FlockOpenID.observer, "FlockDocumentReady");
  obs.removeObserver(FlockOpenID.observer, "earlyformsubmit");

  var browser = getBrowser();
  browser.removeProgressListener(FlockOpenID,
                                 CI.nsIWebProgress.NOTIFY_LOCATION);
};

window.addEventListener("load", FlockOpenID.onLoad, false);
window.addEventListener("unload", FlockOpenID.onUnLoad, false);
