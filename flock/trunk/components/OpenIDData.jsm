var EXPORTED_SYMBOLS = ["OpenIDData"];

const CC = Components.classes;
const CI = Components.interfaces;
const CU = Components.utils;

const DATA_PREF = "flock.openid.data";
const SUGGESTED_OPENID_DATA_PREF = "flock.openid.suggested.data";
const LAST_LOGIN_OPENID_PREF = "flock.openid.lastLoginOpenIDHash.data";

CU.import("resource://fopenid/Persist.jsm");

var OpenIDData = {
  addOpenID: function OpenIDData_addOpenID(aOpenIDObject, aPrefString) {
    if (!aOpenIDObject.id ||
        OpenIDData.existsID(aOpenIDObject.id, aPrefString))
    {
      return;
    }
    var data = Persist.get(aPrefString);
    if (!data) {
      data = [];
    }
    data.push(aOpenIDObject);
    Persist.set(aPrefString, data);
  },

  addHistory: function OpenIDData_addHistory(aID, aURL) {
    var data = Persist.get(DATA_PREF);
    for each (var item in data) {
      if (item.id == aID) {
        if (!item.history) {
          item.history = [];
        } else {
          // Make sure we are not duplicating history URLs
          for (var i = 0; i < item.history.length; i++) {
            if (item.history[i] == aURL) {
              return;
            }
          }
        }
        item.history.push(aURL);
        break;
      }
    }
    Persist.set(DATA_PREF, data);
  },

  getOpenIDs: function OpenIDData_getOpenIDs() {
    return Persist.get(DATA_PREF);
  },

  getSuggested: function OpenIDData_getSuggested() {
    return Persist.get(SUGGESTED_OPENID_DATA_PREF);
  },

  getLastLoginOpenIDForDomain:
  function OpenIDData_getLastLoginOpenIDForDomain(aDomain) {
    var lastLoginOpenID = Persist.get(LAST_LOGIN_OPENID_PREF);
    if (!lastLoginOpenID ||
        (lastLoginOpenID && !lastLoginOpenID[aDomain]))
    {
      return null;
    }
    return lastLoginOpenID[aDomain];
  },

  deleteID: function OpenIDData_deleteID(aID, aPrefString) {
    if (!aID || !OpenIDData.existsID(aID, aPrefString)) {
      return;
    }
    var data = Persist.get(aPrefString);
    for (var i = 0; i < data.length; i++) {
      if (data[i].id == aID) {
        data.splice(i, 1);
        Persist.set(aPrefString, data);
        break;
      }
    }
  },

  setLastLoginOpenIDForDomain:
  function OpenIDData_setLastLoginOpenIDForDomain(aDomain, aID) {
    var lastLoginOpenID = Persist.get(LAST_LOGIN_OPENID_PREF);
    if (!lastLoginOpenID) {
      lastLoginOpenID = {};
    }
    lastLoginOpenID[aDomain] = aID;
    Persist.set(LAST_LOGIN_OPENID_PREF, lastLoginOpenID);
  },

  existsID: function OpenIDData_existsID(aID, aPrefString) {
    var data = Persist.get(aPrefString);
    if (!data) {
      return false;
    }
    for each (var item in data) {
      if (item.id == aID) {
        return true;
      }
    }
    return false;
  },

  getHistoryForID: function OpenIDData_getHistoryForID(aID) {
    var data = Persist.get(DATA_PREF);
    if (!data) {
      return null;
    }
    for each (var item in data) {
      if (item.id != aID) {
        continue;
      }
      return item.history;
    }
    return null;
  },

  reorderID: function OpenIDData_reorderID(aID, aNewPosition) {
    var data = Persist.get(DATA_PREF);
    var newOrder = [];
    var newItem = null;
    for each (var item in data) {
      if (item.id == aID) {
        newItem = item;
        break;
      }
    }
    for each (var item in data) {
      if (newOrder.length == aNewPosition) {
        newOrder.push(newItem);
      } else if (item.id != aID) {
        newOrder.push(item);
      }
    }
    Persist.set(DATA_PREF, newOrder);
    return newOrder;
  }
};
