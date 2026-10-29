/* Public Tizen application APIs. No Mac server, network address or credentials. */
(function () {
  'use strict';
  /* Launch targets, VERIFIED on the device 2026-10-28 via `sdb shell 0 applist`
     on UN65TU690TFXZA (US, Tizen 5.5). Note the TV also ships decoys that carry
     the same display names - com.samsung.tv.aria-dummy, org.tizen.primevideo-dummy
     and com.samsung.tv.cobalt-yt - which the -dummy and cobalt-yt filters below
     exclude. Keep those filters if this list is ever regenerated. */
  var IDS = {
    netflix: 'org.tizen.netflix-app', youtube: '9Ur5IzDKqV.TizenYouTube',
    primevideo: 'org.tizen.primevideo', disneyplus: 'MCmYXNxgcu.DisneyPlus',
    appletv: 'com.samsung.tv.aria-video', hulu: 'LBUAQX1exg.Hulu',
    tubi: '3KA0pm7a7V.TubiTV', spotify: 'rJeHak5zRg.Spotify'
  };
  var STREAMING = [];
  var CONSUMER_SYSTEM = ['org.tizen.browser'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '3KA0pm7a7V.TubiTV': 'tubi'};
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
    'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices'];
  var SELF = 'CleanTU690.Home';
  function api() { return window.tizen && window.tizen.application; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  function launchApp(id, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    function plainLaunch() {
      try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
      catch (err) { finish(failure(err)); }
    }
    /* Launch through an application control with a reply listener rather than a
       bare launch(). That registers this app as the caller, which is what lets
       Tizen hand control back here when the launched app finishes, instead of
       dropping the viewer into Smart Hub. Not every app honours it - plenty exit
       to the platform regardless - so this is best-effort, and any failure falls
       straight through to the plain launch that was here before. */
    try {
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default');
      api().launchAppControl(control, id,
        function () { finish(null); },
        function () { plainLaunch(); },
        { onsuccess: function () {}, onfailure: function () {} });
    } catch (err) { plainLaunch(); }
  }
  function launch(brand, done) {
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], done);
  }
  /* No art(): this TV reports FrameTVSupport=false and has no org.tizen.art-app. */

  /* UNVERIFIED on Tizen 5.5. These IDs come from the Tizen 9 reference TV; the
     2020 platform may name its Smart Hub and Settings apps differently. Confirm
     both against getAppsInfo() before relying on them. */
  /* getAppsContext lists every RUNNING application, not the foreground one.
     There is no foreground query in this API, and treating the list as though
     there were is a trap: Samsung's own home is essentially always running, so
     "is Smart Hub in the list" answers yes while the viewer is mid-film.

     Used for what it actually reports instead - whether a given app is still
     alive. When the app the launcher started disappears from this list, that
     app has exited, which is the moment to come back. */
  /* Smart Hub itself. Deliberately this one id and nothing else: an earlier
     version also listed coba.apps, tv.store and volt.apps, which are resident
     services rather than the screen the viewer sees, so the check answered yes
     permanently. Whether csfs is resident too is the open question this is
     written to answer on the device. */
  var SMART_HUB = 'com.samsung.tv.csfs';
  function smartHubRunning(done) {
    /* isRunning defaults to true when it cannot tell, which is right for
       "is my app still alive" but wrong here: an unknown answer must not
       cause a raise. Ask directly so a failure reads as 'not up'. */
    if (!api() || !api().getAppsContext) { done(false); return; }
    var finished = false;
    var timer = setTimeout(function () { if (!finished) { finished = true; done(false); } }, 1000);
    try {
      api().getAppsContext(function (contexts) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        var i;
        for (i = 0; i < contexts.length; i++) if (contexts[i].appId === SMART_HUB) { done(true); return; }
        done(false);
      }, function () { if (!finished) { finished = true; clearTimeout(timer); done(false); } });
    } catch (err) { if (!finished) { finished = true; clearTimeout(timer); done(false); } }
  }
  function isRunning(appId, done) {
    if (!appId || !api() || !api().getAppsContext) { done(true); return; }
    var finished = false;
    /* On a poll loop, so give up quickly. Answering "still running" on timeout
       is the safe direction: it declines to raise. */
    var timer = setTimeout(function () { if (!finished) { finished = true; done(true); } }, 1200);
    try {
      api().getAppsContext(function (contexts) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        var i;
        for (i = 0; i < contexts.length; i++) {
          if (contexts[i].appId === appId) { done(true); return; }
        }
        done(false);
      }, function () { if (!finished) { finished = true; clearTimeout(timer); done(true); } });
    } catch (err) { if (!finished) { finished = true; clearTimeout(timer); done(true); } }
  }
  /* Diagnostic: the full list of running application ids, as the platform
     reports it. Used to find out which app actually appears when Smart Hub is
     on screen, instead of guessing at ids - two guesses so far, both wrong,
     both of which interrupted playback. */
  function runningIds(done) {
    if (!api() || !api().getAppsContext) { done(null); return; }
    var finished = false;
    var timer = setTimeout(function () { if (!finished) { finished = true; done(null); } }, 1500);
    try {
      api().getAppsContext(function (contexts) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        var ids = [], i;
        for (i = 0; i < contexts.length; i++) ids.push(contexts[i].appId);
        ids.sort();
        done(ids);
      }, function () { if (!finished) { finished = true; clearTimeout(timer); done(null); } });
    } catch (err) { if (!finished) { finished = true; clearTimeout(timer); done(null); } }
  }
  function raiseSelf(done) { launchApp(SELF, done || function () {}); }
  function home(done) { launchApp('com.samsung.tv.csfs', done); }
  function settings(done) { launchApp('com.samsung.tv.coba.setting', done); }
  /* Matching a brand by Tizen application ID alone is brittle: the IDs above are
     unverified, and when one is wrong the app loses its bundled artwork and falls
     back to the TV's own low-resolution icon. Name matching is the reliable
     signal, because getAppsInfo reports the display name the TV shows. */
  var BY_NAME = {
    'netflix': 'netflix', 'youtube': 'youtube', 'prime video': 'primevideo',
    'disney+': 'disneyplus', 'disney plus': 'disneyplus', 'apple tv': 'appletv',
    'hulu': 'hulu', 'tubi': 'tubi', 'spotify': 'spotify'
  };
  function normName(a) { return String(a.name || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  /* A bare prefix test would let "Netflix Free Movies" claim the netflix brand,
     and because a brand makes an app primary - skipping the consumer and
     service-name filters - main.js would then rebind the real Netflix tile's
     launch target to it while still showing the name "Netflix". So a prefix only
     counts when the next character is a separator, and brands are assigned in
     three ordered passes so a genuine match always beats a looser one. */
  function prefixBrand(a) {
    var n = normName(a), key;
    for (key in BY_NAME) {
      if (!BY_NAME.hasOwnProperty(key)) continue;
      if (n.length > key.length && n.indexOf(key) === 0 && ' -:–—'.indexOf(n.charAt(key.length)) >= 0) return BY_NAME[key];
    }
    return '';
  }
  /* One app per brand, decided before anything is built: an exact ID match wins,
     then an exact name, then a separator-delimited prefix. First claim holds, so
     a later app can never take over a brand already resolved. */
  function assignBrands(known, list) {
    var owner = {}, claim = {}, i, a, b;
    function take(a, b) { if (b && !owner[b]) { owner[b] = a.id; claim[a.id] = b; } }
    for (i = 0; i < list.length; i++) { a = list[i]; take(a, known[a.id]); }
    for (i = 0; i < list.length; i++) { a = list[i]; if (!claim[a.id]) take(a, BY_NAME[normName(a)]); }
    for (i = 0; i < list.length; i++) { a = list[i]; if (!claim[a.id]) take(a, prefixBrand(a)); }
    return claim;
  }
  function apps(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      api().getAppsInfo(function (list) {
        var known = {}, seen = {}, result = [];
        Object.keys(IDS).forEach(function (brand) { if (IDS[brand]) known[IDS[brand]] = brand; });
        var claimed = assignBrands(known, list);
        list.forEach(function (a) {
          var brand = claimed[a.id] || '';
          /* Only an ID match may bypass the filters below. A name-derived brand
             still has to look like a consumer app on its own merits; it selects
             artwork, it does not grant trust. */
          var primary = !!known[a.id], stream = STREAMING.indexOf(a.id) >= 0;
          var consumer = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(a.id) || CONSUMER_SYSTEM.indexOf(a.id) >= 0;
          /* A name-matched app earns its place only by being one the TV itself
             shows to the viewer, and it still has to clear the service-name
             filter below. Only an ID match skips those checks. */
          var allowed = primary || stream || (brand && a.show) || (a.show && consumer);
          if (a.id === SELF || INTERNAL.indexOf(a.id) >= 0 || seen[a.id] || !a.name || !allowed) return;
          if (!primary && /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon)/i.test(a.name + ' ' + a.id)) return;
          if (/-dummy$/.test(a.id) || a.id === 'com.samsung.tv.cobalt-yt') return;
          seen[a.id] = true;
          var order = brand ? Object.keys(IDS).indexOf(brand) : -1;
          result.push({ appId: a.id, name: a.name, brand: brand || EXTRA_BRANDS[a.id] || '', icon: a.iconPath || '', rank: order >= 0 ? order : (stream ? 20 : 30) });
        });
        result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
        finish(null, result);
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  window.FrameDevice = { launch: launch, launchApp: launchApp, home: home, settings: settings, apps: apps,
    isRunning: isRunning, smartHubRunning: smartHubRunning, raiseSelf: raiseSelf,
    runningIds: runningIds };
}());
