/* Charlotte Baker Memorial Fund — sponsor manager (admin.html)

   Edits the sponsor list and commits it straight to the GitHub repo. A push to
   main makes GitHub Pages rebuild, so saving here publishes the live site.

   Auth is a GitHub fine-grained token, pasted once and kept in localStorage.
   There is no separate password: the token IS the credential. A bad token
   cannot save, which is the honest version of a login on a static site.
   The token is never committed — it only ever lives in this browser. */
(function () {
  "use strict";

  var OWNER = "joshbaker624";
  var REPO = "cbmf-website";
  var BRANCH = "main";
  var LOGO_DIR = "assets/img/sponsors";
  var DATA_PATH = "sponsors.json";
  var LIVE_URL = "https://cbmemorialfund.com/";

  var TOKEN_KEY = "cbmf.gh.token";
  var DRAFT_KEY = "cbmf.sponsors.draft";
  var LOGO_MAX_W = 320;
  var LOGO_MAX_H = 160;

  var $ = function (id) { return document.getElementById(id); };
  var token = "";
  var state = [];          /* [{ name, logo }] — logo is a repo path, or a data: URI while pending */
  var pristine = "[]";
  var knownLogos = [];     /* logo paths already in the repo, for orphan cleanup */
  var previewTimer = null;

  /* ---------- GitHub API ---------- */
  function gh(path, options) {
    var opts = options || {};
    return fetch("https://api.github.com" + path, {
      method: opts.method || "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (err) {
          var msg = err.message || r.statusText;
          if (r.status === 401) msg = "GitHub rejected that token. It may be expired or mistyped.";
          if (r.status === 403) msg = "That token doesn't have Contents write access to this repo.";
          if (r.status === 404) msg = "Token can't see " + OWNER + "/" + REPO + ". Check the token's repository access.";
          throw new Error(msg);
        });
      }
      return r.status === 204 ? null : r.json();
    });
  }

  /* ---------- Sign in ---------- */
  function signIn(candidate) {
    token = candidate;
    return gh("/repos/" + OWNER + "/" + REPO).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        throw new Error("That token can read the repo but not write to it. Set Contents to “Read and write”.");
      }
      try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
      $("login").hidden = true;
      $("panel").hidden = false;
      $("signout").hidden = false;
      load();
    });
  }

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("login-error");
    var btn = $("login-btn");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Checking…";
    signIn($("token").value.trim()).catch(function (ex) {
      token = "";
      err.textContent = ex.message;
      err.hidden = false;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = "Sign in";
    });
  });

  $("signout").addEventListener("click", function () {
    if (!confirm("Sign out and forget the token in this browser?")) return;
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    location.reload();
  });

  try {
    var saved = localStorage.getItem(TOKEN_KEY);
    if (saved) signIn(saved).catch(function () { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} });
  } catch (e) {}

  /* ---------- Load ---------- */
  function load() {
    fetch(DATA_PATH + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (live) {
        var liveList = Array.isArray(live) ? live : [];
        pristine = JSON.stringify(liveList);
        knownLogos = liveList.map(function (s) { return s.logo; })
          .filter(function (p) { return p && p.indexOf(LOGO_DIR) === 0; });

        var draft = null;
        try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
        if (Array.isArray(draft) && JSON.stringify(draft) !== pristine) {
          state = draft;
          note("draft-notice", "You have unsaved changes from last time. “Discard changes” goes back to what's published.", false);
        } else {
          state = liveList;
        }
        render();
      });
  }

  function note(id, text, hide) {
    var el = $(id);
    el.textContent = text;
    el.hidden = !!hide;
  }

  function persist() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function dirty() { return JSON.stringify(state) !== pristine; }

  /* ---------- Rows ---------- */
  function render() {
    var box = $("rows");
    box.textContent = "";

    if (!state.length) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No sponsors yet. Add one to get started.";
      box.appendChild(empty);
    }

    state.forEach(function (sponsor, i) {
      var row = document.createElement("div");
      row.className = "row";

      var thumb = document.createElement("div");
      thumb.className = "thumb";
      if (sponsor.logo) {
        var img = document.createElement("img");
        img.src = sponsor.logo;
        img.alt = "";
        thumb.appendChild(img);
      } else {
        var none = document.createElement("span");
        none.className = "empty";
        none.textContent = "no logo";
        thumb.appendChild(none);
      }
      row.appendChild(thumb);

      var fields = document.createElement("div");
      fields.className = "fields";

      var name = document.createElement("input");
      name.type = "text";
      name.value = sponsor.name || "";
      name.placeholder = "Sponsor name";
      name.setAttribute("aria-label", "Sponsor name");
      name.addEventListener("input", function () {
        state[i].name = name.value;
        persist();
        refreshStatus();
        queuePreview();
      });
      fields.appendChild(name);

      var fileline = document.createElement("div");
      fileline.className = "fileline";

      var file = document.createElement("input");
      file.type = "file";
      file.accept = "image/*";
      file.hidden = true;
      file.addEventListener("change", function () {
        if (!file.files || !file.files[0]) return;
        resizeImage(file.files[0]).then(function (dataUri) {
          state[i].logo = dataUri;   /* uploaded on save */
          persist();
          render();
          queuePreview(0);
        }).catch(function () {
          alert("That file could not be read as an image. Try a PNG, JPG or WebP.");
        });
      });

      var pick = document.createElement("button");
      pick.type = "button";
      pick.textContent = sponsor.logo ? "Replace logo" : "Upload logo";
      pick.addEventListener("click", function () { file.click(); });
      fileline.appendChild(pick);
      fileline.appendChild(file);

      if (sponsor.logo) {
        var drop = document.createElement("button");
        drop.type = "button";
        drop.textContent = "Remove logo";
        drop.addEventListener("click", function () {
          delete state[i].logo;
          persist();
          render();
          queuePreview(0);
        });
        fileline.appendChild(drop);

        if (isPending(sponsor.logo)) {
          var tag = document.createElement("span");
          tag.className = "size";
          tag.textContent = "new · " + Math.round(sponsor.logo.length * 0.75 / 1024) + " KB";
          fileline.appendChild(tag);
        }
      }
      fields.appendChild(fileline);
      row.appendChild(fields);

      var actions = document.createElement("div");
      actions.className = "actions";
      actions.appendChild(actionBtn("↑", "Move up", i === 0, function () { move(i, -1); }));
      actions.appendChild(actionBtn("↓", "Move down", i === state.length - 1, function () { move(i, 1); }));
      var rm = actionBtn("×", "Remove " + (sponsor.name || "sponsor"), false, function () {
        state.splice(i, 1);
        persist();
        render();
        queuePreview(0);
      });
      rm.classList.add("rm");
      actions.appendChild(rm);
      row.appendChild(actions);

      box.appendChild(row);
    });

    refreshStatus();
    queuePreview(0);
  }

  function refreshStatus() {
    $("reload").disabled = !dirty();
    $("publish").disabled = !dirty();
    $("count").textContent = state.length
      ? state.length + " sponsor" + (state.length === 1 ? "" : "s") + (dirty() ? " · unsaved changes" : " · published")
      : "";
  }

  function actionBtn(glyph, label, disabled, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = glyph;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.disabled = disabled;
    b.addEventListener("click", fn);
    return b;
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.length) return;
    var tmp = state[i];
    state[i] = state[j];
    state[j] = tmp;
    persist();
    render();
  }

  function isPending(logo) { return typeof logo === "string" && logo.indexOf("data:") === 0; }

  /* ---------- Logo resize ----------
     Fit inside LOGO_MAX_W x LOGO_MAX_H and re-encode, so a 4 MB phone photo of
     a banner doesn't get committed to the repo at full size. */
  function resizeImage(fileObj) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var scale = Math.min(LOGO_MAX_W / img.width, LOGO_MAX_H / img.height, 1);
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          var webp = canvas.toDataURL("image/webp", 0.85);
          resolve(webp.indexOf("data:image/webp") === 0 ? webp : canvas.toDataURL("image/png"));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(fileObj);
    });
  }

  function slugify(text, fallback) {
    var s = (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s || fallback;
  }

  /* ---------- Publish ----------
     One atomic commit via the git tree API: blobs for new logos, the updated
     sponsors.json, and deletions for orphaned logos all land together. */
  function publish() {
    var btn = $("publish");
    btn.disabled = true;
    var used = [];
    var tree = [];

    note("publish-status", "Uploading logos…", false);
    $("publish-status").className = "msg warn";

    /* 1. Turn every pending data: URI into a blob and give it a repo path */
    var uploads = state.map(function (sponsor, i) {
      if (!isPending(sponsor.logo)) {
        if (sponsor.logo) used.push(sponsor.logo);
        return Promise.resolve();
      }
      var comma = sponsor.logo.indexOf(",");
      var meta = sponsor.logo.slice(5, comma);
      var ext = meta.indexOf("webp") > -1 ? "webp" : "png";
      var path = LOGO_DIR + "/" + slugify(sponsor.name, "sponsor-" + (i + 1)) + "-" + Date.now().toString(36) + "." + ext;
      return gh("/repos/" + OWNER + "/" + REPO + "/git/blobs", {
        method: "POST",
        body: { content: sponsor.logo.slice(comma + 1), encoding: "base64" }
      }).then(function (blob) {
        tree.push({ path: path, mode: "100644", type: "blob", sha: blob.sha });
        state[i].logo = path;
        used.push(path);
      });
    });

    return Promise.all(uploads)
      .then(function () {
        /* 2. Delete logo files nothing points at any more */
        knownLogos.forEach(function (path) {
          if (used.indexOf(path) === -1) tree.push({ path: path, mode: "100644", type: "blob", sha: null });
        });
        /* 3. The data file itself, inlined as text */
        tree.push({
          path: DATA_PATH, mode: "100644", type: "blob",
          content: JSON.stringify(state, null, 2) + "\n"
        });
        note("publish-status", "Committing…", false);
        return gh("/repos/" + OWNER + "/" + REPO + "/git/ref/heads/" + BRANCH);
      })
      .then(function (ref) {
        var parent = ref.object.sha;
        return gh("/repos/" + OWNER + "/" + REPO + "/git/commits/" + parent).then(function (commit) {
          return gh("/repos/" + OWNER + "/" + REPO + "/git/trees", {
            method: "POST",
            body: { base_tree: commit.tree.sha, tree: tree }
          }).then(function (newTree) {
            return gh("/repos/" + OWNER + "/" + REPO + "/git/commits", {
              method: "POST",
              body: {
                message: "Update sponsors (" + state.length + ")\n\nEdited from the sponsor manager at /admin.html.",
                tree: newTree.sha,
                parents: [parent]
              }
            });
          });
        });
      })
      .then(function (newCommit) {
        return gh("/repos/" + OWNER + "/" + REPO + "/git/refs/heads/" + BRANCH, {
          method: "PATCH",
          body: { sha: newCommit.sha }
        });
      })
      .then(function () {
        pristine = JSON.stringify(state);
        knownLogos = used.slice();
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        $("draft-notice").hidden = true;
        render();
        $("publish-status").className = "msg ok";
        note("publish-status", "Committed. GitHub Pages is rebuilding — usually live within a minute.", false);
        waitForLive();
      })
      .catch(function (ex) {
        $("publish-status").className = "msg error";
        note("publish-status", "Nothing was published: " + ex.message, false);
        refreshStatus();
      });
  }

  /* Poll the live site until it serves what we just committed. Purely
     informational — if the fetch is blocked, the commit still happened. */
  function waitForLive() {
    var target = JSON.stringify(state);
    var tries = 0;
    (function check() {
      if (++tries > 20) return;
      setTimeout(function () {
        fetch(LIVE_URL + DATA_PATH + "?t=" + Date.now(), { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (live) {
            if (JSON.stringify(live) === target) {
              note("publish-status", "Live at cbmemorialfund.com — the marquee is updated.", false);
            } else { check(); }
          })
          .catch(function () { /* CORS or offline: leave the commit message as-is */ });
      }, 6000);
    })();
  }

  $("publish").addEventListener("click", publish);

  $("add").addEventListener("click", function () {
    state.push({ name: "" });
    persist();
    render();
    var inputs = $("rows").querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $("reload").addEventListener("click", function () {
    if (!confirm("Discard your changes and go back to the published list?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    $("draft-notice").hidden = true;
    state = JSON.parse(pristine);
    render();
  });

  window.addEventListener("beforeunload", function (e) {
    if (dirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Preview ---------- */
  function queuePreview(delay) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      var marquee = $("preview-marquee");
      var ok = window.CBMF && window.CBMF.renderMarquee && window.CBMF.renderMarquee(marquee, state);
      marquee.hidden = !ok;
      $("preview-empty").hidden = !!ok;
    }, typeof delay === "number" ? delay : 450);
  }
})();
