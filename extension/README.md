# Open Video Downloader Companion

A Chrome extension that finds video sources on the page you are viewing and sends them to
Open Video Downloader, together with the cookies and request headers the browser used.
Use it for videos the app cannot find from the page address alone, or that need you to be signed in.

## Install

The extension is not in the Chrome Web Store yet, so load it from this folder. If you installed the
app from a release, get the folder by downloading the source code of that release (or cloning this
repository).

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select this `extension` folder.
3. Start Open Video Downloader and click the extension's icon. Under **Connect to the app**:
   1. Click **Connect**. The app comes to the front and asks whether to allow it.
   2. Choose **Allow**. The app copies a connection key, which stays on the clipboard for a minute
      and a half.
   3. Click the extension's icon again (its popup closes when the app comes forward), paste the
      key, and choose **Finish**.

Connecting is needed once. Chrome 120 or newer is required. Other Chromium browsers (Edge, Brave)
should work but are untested.

## Use

Play the video, then click the extension icon. The popup lists:

- **The page itself.** The app works out the video from the page address, as it does for a link you
  paste, with the browser's cookies for that page added. This is the best choice for sites the app
  already supports.
- **Detected sources.** HLS streams, DASH streams and media files the page loaded.

When the list opens, what the page itself loaded comes first, best candidate on top and anything
marked **DRM protected** last; such a source will most likely fail to download. A source marked
**embedded from …** was loaded by a frame from another site, such as an embedded player or an
advert, and comes after the page's own. Sources that turn up while the list is open are added at
the end, so that rows do not move while you are choosing.

Each row can **Download now**, **Add to queue** (to pick format and quality in the app first), or
**Copy address**. Download now on a page that turns out to be a playlist or channel still asks in
the app which items to take.

Other ways to send, both of which add to the queue:

- **Right-click menu:** send the page, a link, or a video.
- **Keyboard shortcut:** Alt+Shift+O sends the best stream the page itself loaded, or the page when
  there is none. Change it at `chrome://extensions/shortcuts`.

The popup's "Side panel" button keeps the list open while you browse.

A stream has no title of its own, so its download is named after the page. When the app's queue
already has an item of that name, the app adds a number, as in "Page title (2)".

## How it works

- **Detection.** The extension watches the requests a tab makes. HLS and DASH manifests are listed,
  as are media files of 1 MB or more (or of unknown size); stream segments are ignored.
- **The list belongs to the page.** It starts over when the tab loads another page, or when a
  single-page site moves to another path. When only the query or fragment of the address changes
  (which may be the next video, or just a playback position), the list is kept and whatever loads
  from then on is ranked first.
- **Labels.** The extension reads each detected manifest itself to label DRM, show the best quality,
  and fold the quality variants of one stream into a single row; for an HLS stream it also reads the
  first variant on the same site. It sends cookies with such a request only when the page asked its
  own site for the manifest, follows no redirects, and does none of this for a private window.
- **Sending.** The chosen address goes to the app at `http://127.0.0.1:46123` with the request
  headers the browser used (such as `Referer` and `Authorization`) and the page title. Of the
  cookies the browser holds for the source's address, only those it sent when the page loaded the
  source go along (all of them, if the extension did not see that request's headers). The cookies
  for the page's own site are added when the page itself loaded the source, because a stream
  hosted elsewhere may fetch its key from the page's site.
- **In the app.** The app queues the link like a pasted one and passes the cookies and headers to
  yt-dlp. See `src-tauri/src/bridge.rs`.

## Permissions and privacy

| Permission | Why |
|---|---|
| Access to all sites | See which media a page loads, and read the cookies needed to download it |
| `webRequest` | Detect media requests and the headers sent with them |
| `webNavigation` | Start a new list when the tab moves to another page |
| `cookies` | Give the app the same session the browser has |
| `storage` | Remember detected sources per tab (in memory only) and the connection key |
| `contextMenus`, `sidePanel`, `notifications` | The right-click menu, side panel, and send results |

Nothing is sent to anyone but the sites you are already visiting and the app on this computer.

- Cookies and headers go to the app only when you send a source, and only after the app has proven
  it holds the connection key.
- The app keeps the cookies in a file in its own cache folder, which other users of the computer
  cannot open, and deletes it when it exits (or the next time it starts, if it did not exit cleanly).
- The app leaves cookies and headers out of its logs and error reports. For an item that came with
  them, the address also loses everything from `?` on (where access tokens usually are) in the
  app's logs, in the state attached to error reports, and in the yt-dlp messages kept for display
  and reports, including the name yt-dlp makes up from the end of an address.

### Who can talk to the app

Anything on a computer can reach a local port, so the extension and the app each prove who they
are before anything is exchanged:

- **The connection key.** The app creates a key, kept in its folder for local data under your
  user account, and gives it to you
  through the clipboard when you choose Allow; you paste it into the extension. From then on the
  app must prove it holds the key before the extension sends anything, and every link the extension
  sends is signed with it. Another person signed in to the same computer cannot read your key file
  or your clipboard, so they can neither queue downloads in your app nor pose as the app to collect
  your cookies. See Limits for what the key does not cover.
- **The extension's ID.** Requests must also name this extension as their origin. That keeps web
  pages out: a page cannot claim to be an extension. It is not proof against another extension or
  program that writes its own request headers; the connection key is what stops those. The ID is
  fixed for copies loaded from this folder by the `key` in `manifest.json`, which is a public key
  and not a secret. A Chrome Web Store release will have a different ID, which then has to be added
  to `EXTENSION_ORIGIN` in `src-tauri/src/bridge.rs`, and the `key` removed from the uploaded manifest.

To disconnect, use "Disconnect from the app" in the popup. To make the app issue a new key, quit it
and delete the `bridge-key` file in its data folder.

## Limits

- **DRM.** Streams protected by Widevine, PlayReady or FairPlay cannot be downloaded. This is by design.
- **Unlabelled DRM.** A manifest the extension cannot read itself (it may need a header only the
  page sends, or be open in a private window) is listed without a DRM label, and media files are
  never labelled.
- **Headers and cookies are not tied to one request.** yt-dlp sends the forwarded headers with every
  request for that download, so an `Authorization` header captured for one server also reaches the
  servers the stream's segments come from, and a server it is redirected to. The cookies go only to
  the sites they belong to, but a stream decides which addresses on those sites are fetched.
- **Other users of the computer can see running commands.** While a download runs, its yt-dlp
  command line (the address, the forwarded headers, and for some live streams the cookies) is
  visible to other people signed in to the same computer, as it is for the sign-in details set in
  the app itself.
- **Programs running as you.** A program running under your own user account can read the cookie
  file, the connection key and the clipboard (a clipboard manager keeps what was on it), as it can
  read much else of yours. An extension that controls the browser's proxy settings could also
  place itself between this extension and the app.
- **The app always listens.** The app listens on its local port whenever it runs, with no setting
  to turn that off yet. Another program on the computer can keep the port busy, or make the app
  ask whether to connect (at most once a minute after a refusal); without the key it can do no more.
- **Preloaded and restored pages.** Chrome sometimes loads a page in the background before you open
  it, or brings one back instantly when you go back. Sources loaded before the page was shown are
  not listed; reload the page.
- **One-time addresses.** Reading a manifest to label it costs one or two extra requests; a site
  that issues single-use manifest addresses may reject the app's request afterwards.
- **The saved file remembers where it came from.** With "add metadata" on in the app, the file's
  tags include the address it was downloaded from, as for any download.
- **English only.** The extension, and the app's connection dialog in languages other than English,
  are not translated yet.

## Development

There is no build step. The files in this folder are what Chrome loads.

```
npm run test:extension   # unit tests for detect.js
npm run test:e2e         # includes tests/e2e/extension.spec.ts, which loads the extension in Chromium
```

After changing files, reload the extension at `chrome://extensions`.
