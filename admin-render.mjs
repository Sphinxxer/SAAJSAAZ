const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shell(body,data) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>Organiser access — SAAJSAAZ</title>' +
    '<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/admin.css"></head><body>' +
    '<header class="site-header"><div class="wrap header-inner"><a class="wordmark" href="/">SAAJSAAZ</a><a class="admin-return" href="/">View website</a></div></header>' +
    '<main class="admin-wrap">' + body + '</main>' +
    (data ? '<script type="application/json" id="admin-data">' + JSON.stringify(data).replace(/</g,'\\u003c') + '</script>' : '') +
    '<script type="module" src="/assets/admin.mjs"></script></body></html>';
}
export function renderAdminLogin() {
  return shell('<section class="admin-login"><h1>Organiser access</h1><p class="admin-intro">Sign in to manage your events.</p>' +
    '<form id="login-form"><div class="admin-field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="128"></div>' +
    '<div class="admin-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"></div>' +
    '<p id="admin-message" role="status" hidden></p><button class="button admin-submit" type="submit">Sign in</button></form></section>');
}
export function renderAdmin(configuration) {
  return shell('<div class="admin-heading"><div><h1>Manage events</h1><p class="admin-intro">Update the details your guests see.</p></div>' +
    '<button class="admin-text-button" id="logout" type="button">Sign out</button></div>' +
    '<nav class="admin-section-nav" aria-label="Editor sections"><a href="#event-details">Event details</a><a href="#event-copy">Copy and venue</a><a href="#workshop-fields" data-workshop-editor-link>Workshop</a><a href="#pass-prices">Prices</a><a href="#social-heading">Reels</a></nav><p class="dirty-status" id="dirty-status" role="status">All changes saved</p>'+
    '<div class="admin-field admin-event-picker"><label for="event-select">Event</label><select id="event-select">' +
    configuration.events.map(e=>'<option value="' + escape(e.slug) + '">' + escape(e.title) + '</option>').join('') +
    '</select></div><form id="event-form"><fieldset id="event-details"><legend>Event details</legend>' +
    '<div class="admin-field"><label for="event-name">Event name</label><input id="event-name" name="name" required maxlength="120"></div>' +
    '<div class="admin-grid"><div class="admin-field"><label for="start-date">Start date</label><input id="start-date" name="startDate" type="date" required></div>' +
    '<div class="admin-field"><label for="end-date">End date</label><input id="end-date" name="endDate" type="date" required></div>' +
    '<div class="admin-field"><label for="start-time">Daily start time</label><input id="start-time" name="startTime" type="time" required></div>' +
    '<div class="admin-field"><label for="end-time">Daily end time</label><input id="end-time" name="endTime" type="time" required></div></div>' +
    '<p class="admin-hint">Dates and times use India time.</p><p id="date-review-notice" class="date-review-notice" hidden>Dates changed. Review your headline, description and introduction before saving. Pass coverage is calculated from the date range.</p></fieldset>' +
    '<fieldset id="event-copy"><legend>Event copy and venue</legend>'+
    '<div class="admin-field"><label for="headline">Homepage headline</label><input id="headline" required maxlength="180"></div>'+
    '<div class="admin-field"><label for="description">Event description</label><textarea id="description" rows="3" required maxlength="1000"></textarea></div>'+
    '<div class="admin-field"><label for="intro">Event page introduction</label><textarea id="intro" rows="2" required maxlength="1000"></textarea></div>'+
    '<div class="admin-field"><label for="city">City</label><input id="city" required maxlength="120"></div>'+
    '<div class="admin-field"><label for="venue">Venue address</label><textarea id="venue" rows="2" required maxlength="500"></textarea></div></fieldset>'+
    '<fieldset id="workshop-fields"><legend>Workshop dates</legend><div class="admin-grid" id="workshop-inputs"></div></fieldset>' +
    '<fieldset id="pass-prices"><legend>Pass prices</legend><div class="admin-grid" id="price-inputs"></div><p class="admin-hint">Price per pass, in rupees.</p></fieldset>' +
    '<label class="admin-toggle"><input type="checkbox" id="booking-enabled"> Accept booking requests</label>' +
    '<details class="admin-review" id="admin-review"><summary>Review event and booking message</summary><div class="draft-summary" id="draft-summary"></div><p class="admin-hint">Example message using one of each pass. This preview does not save changes.</p><pre id="draft-message"></pre></details>'+
    '<div class="admin-save"><p id="admin-message" role="status" hidden></p><button class="button" type="submit" id="save-event">Save changes</button>' +
    '<span class="admin-hint">Changes appear on the website after saving.</span></div></form>'+
    '<section class="admin-social" aria-labelledby="social-heading"><h2 id="social-heading">Homepage reels</h2>'+
    '<p class="admin-intro">Paste public Instagram reel links. Choose their captions, order and visibility.</p>'+
    '<form id="social-form"><div id="reel-editor-list"></div><button class="admin-text-button" id="add-reel" type="button">Add a reel</button>'+
    '<p class="admin-hint">Instagram controls playback and availability. Guests always have a Watch on Instagram link.</p>'+
    '<div class="admin-save"><p id="social-message" role="status" hidden></p>'+
    '<button class="button" id="save-reels" type="submit">Save reels</button>'+
    '<span class="admin-hint">Saving an empty list removes the reel showcase.</span></div></form></section>',configuration);
}
