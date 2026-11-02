/**
 * Jim moved to its own address. On the old one, every /jim/... address
 * serves jim-moved.html, which runs this: it wipes what Jim left in this
 * browser, then sends the visitor to the same page at the new address.
 *
 * What it removes, and nothing else:
 * - localStorage and sessionStorage keys that start with "jim:" or "jim-"
 * - the "jim" IndexedDB database (Jim's offline copy)
 * - the owner's Firebase sign-in record (IndexedDB, or localStorage when the
 *   SDK fell back to it); other users, such as anonymous game players, stay
 * - caches whose names start with "jim-"
 * - service worker registrations whose scope ends with "/jim"
 *
 * Every step is best effort and capped at 2 seconds, so a blocked or hung
 * store never keeps the visitor here.
 *
 * Under a test runner (`module` exists) it only exposes `wipeJim` and
 * `target` on globalThis.__jimMoved and runs nothing.
 */
(function () {
  "use strict";

  var NEW_ORIGIN = "https://jim.gentryriggen.com";
  var OWNER_UID = "nmt3n9sdfCX2NfzVlTdyXsWzHqm2";
  var AUTH_DB = "firebaseLocalStorageDb";
  var AUTH_STORE = "firebaseLocalStorage";
  var AUTH_KEY_PREFIX = "firebase:authUser:";
  var STEP_CAP_MS = 2000;

  function isJimKey(key) {
    return (
      typeof key === "string" &&
      (key.indexOf("jim:") === 0 || key.indexOf("jim-") === 0)
    );
  }

  function isOwnerAuthKey(storage, key) {
    if (typeof key !== "string" || key.indexOf(AUTH_KEY_PREFIX) !== 0) {
      return false;
    }
    try {
      var user = JSON.parse(storage.getItem(key));
      return !!user && user.uid === OWNER_UID;
    } catch {
      return false;
    }
  }

  function wipeStorage(storage, withAuth) {
    if (!storage) return;
    var doomed = [];
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (isJimKey(key) || (withAuth && isOwnerAuthKey(storage, key))) {
        doomed.push(key);
      }
    }
    for (var j = 0; j < doomed.length; j += 1) storage.removeItem(doomed[j]);
  }

  function deleteJimDatabase(idb) {
    return new Promise(function (resolve) {
      var req = idb.deleteDatabase("jim");
      req.onsuccess = resolve;
      req.onerror = resolve;
      // Another open tab holds it; it goes once that tab closes.
      req.onblocked = resolve;
    });
  }

  function deleteOwnerSignIn(idb) {
    return new Promise(function (resolve) {
      var req = idb.open(AUTH_DB);
      // Never create the database just to look in it.
      req.onupgradeneeded = function () {
        try {
          req.transaction.abort();
        } catch {
          // The open fails either way.
        }
      };
      req.onerror = resolve;
      req.onblocked = resolve;
      req.onsuccess = function () {
        var db = req.result;
        function done() {
          try {
            db.close();
          } catch {
            // Closing is best effort.
          }
          resolve();
        }
        if (!db.objectStoreNames.contains(AUTH_STORE)) {
          done();
          return;
        }
        var tx;
        try {
          tx = db.transaction(AUTH_STORE, "readwrite");
        } catch {
          done();
          return;
        }
        tx.oncomplete = done;
        tx.onerror = done;
        tx.onabort = done;
        var cursorReq = tx.objectStore(AUTH_STORE).openCursor();
        cursorReq.onsuccess = function () {
          var cursor = cursorReq.result;
          if (!cursor) return;
          var record = cursor.value;
          if (record && record.value && record.value.uid === OWNER_UID) {
            cursor.delete();
          }
          cursor.continue();
        };
      };
    });
  }

  function deleteJimCaches(caches) {
    return caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return name.indexOf("jim-") === 0;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    });
  }

  function unregisterJimWorkers(serviceWorker) {
    return serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(
        regs
          .filter(function (reg) {
            return /\/jim$/.test(reg.scope);
          })
          .map(function (reg) {
            return reg.unregister();
          })
      );
    });
  }

  /** Runs one step, ignoring its failure, for at most `ms`. */
  function capped(step, ms) {
    var work = new Promise(function (resolve) {
      resolve(step());
    }).catch(function () {});
    var timer;
    var cap = new Promise(function (resolve) {
      timer = setTimeout(resolve, ms);
    });
    return Promise.race([work, cap]).then(function () {
      clearTimeout(timer);
    });
  }

  /**
   * Removes Jim's data from this browser. `env` holds the browser's stores
   * (any may be missing): localStorage, sessionStorage, indexedDB, caches,
   * serviceWorker; `capMs` overrides the per-step cap.
   */
  function wipeJim(env) {
    var ms = env.capMs || STEP_CAP_MS;
    var steps = [
      function () {
        wipeStorage(env.localStorage, true);
      },
      function () {
        wipeStorage(env.sessionStorage, false);
      },
    ];
    if (env.indexedDB) {
      steps.push(function () {
        return deleteJimDatabase(env.indexedDB);
      });
      steps.push(function () {
        return deleteOwnerSignIn(env.indexedDB);
      });
    }
    if (env.caches) {
      steps.push(function () {
        return deleteJimCaches(env.caches);
      });
    }
    if (env.serviceWorker) {
      steps.push(function () {
        return unregisterJimWorkers(env.serviceWorker);
      });
    }
    return Promise.all(
      steps.map(function (step) {
        return capped(step, ms);
      })
    ).then(function () {});
  }

  /** The same Jim page at the new address (anything else: Jim's home). */
  function target(location) {
    var pathname = location.pathname || "";
    var path =
      pathname === "/jim" || pathname.indexOf("/jim/") === 0
        ? pathname
        : "/jim";
    return NEW_ORIGIN + path + (location.search || "");
  }

  if (typeof module !== "undefined") {
    globalThis.__jimMoved = { wipeJim: wipeJim, target: target };
    return;
  }

  /** A store the browser refuses (private mode, blocked data) is skipped. */
  function get(read) {
    try {
      return read();
    } catch {
      return undefined;
    }
  }

  var env = {
    localStorage: get(function () {
      return window.localStorage;
    }),
    sessionStorage: get(function () {
      return window.sessionStorage;
    }),
    indexedDB: get(function () {
      return window.indexedDB;
    }),
    caches: get(function () {
      return window.caches;
    }),
    serviceWorker: get(function () {
      return window.navigator.serviceWorker;
    }),
  };
  var next = target(location);
  wipeJim(env).then(
    function () {
      location.replace(next);
    },
    function () {
      location.replace(next);
    }
  );
})();
