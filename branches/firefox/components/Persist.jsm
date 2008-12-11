var EXPORTED_SYMBOLS = ["Persist"];

const CC = Components.classes;
const CI = Components.interfaces;

var gPrefs = null;
function prefs() {
  if (!gPrefs) {
    gPrefs = CC["@mozilla.org/preferences-service;1"]
             .getService(CI.nsIPrefBranch);
  }
  return gPrefs;
}

var Persist = {

  get: function Persist_get(aPref) {
    if (prefs().getPrefType(aPref) != CI.nsIPrefBranch.PREF_STRING) {
      return null;
    }
    var nsJSON = CC["@mozilla.org/dom/json;1"].createInstance(CI.nsIJSON);
    return nsJSON.decode(prefs().getCharPref(aPref));
  },

  set: function Persist_set(aPref, aObject) {
    var nsJSON = CC["@mozilla.org/dom/json;1"].createInstance(CI.nsIJSON);
    prefs().setCharPref(aPref, nsJSON.encode(aObject));
  },

  watch: function Persist_watch(aPref, aCallback) {
  }

};
