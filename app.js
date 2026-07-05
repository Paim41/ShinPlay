(function () {
  "use strict";

  const storageKey = "shinplay:v2";
  const initialState = {
    queue: [],
    favorites: [],
    history: [],
    playlists: [{ id: "default", name: "Main queue", items: [] }],
    activePlaylistId: "default",
    current: null,
    currentIndex: -1,
    repeat: "off",
    theme: "light",
    apiKey: "",
    settings: {
      audioOnly: false,
      theater: false,
      wakeLock: false,
      reduceMotion: false,
      volume: 80,
      speed: 1,
      bass: 0,
      treble: 0
    }
  };

  let state = loadState();
  let player = null;
  let playerReady = false;
  let youtubeApiReady = false;
  let playerState = -1;
  let progressTimer = 0;
  let sleepTimer = 0;
  let sleepFadeTimer = 0;
  let wakeLock = null;
  let activeLibrary = "favorites";
  let lastRemoved = null;
  let miniDrag = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    urlInput: $("#urlInput"),
    loadForm: $("#loadForm"),
    addToQueueButton: $("#addToQueueButton"),
    shareCurrentButton: $("#shareCurrentButton"),
    downloadButton: $("#downloadButton"),
    currentThumb: $("#currentThumb"),
    nowTitle: $("#now-playing-title"),
    nowMeta: $("#nowMeta"),
    playerStatus: $("#playerStatus"),
    elapsedTime: $("#elapsedTime"),
    durationTime: $("#durationTime"),
    seekRange: $("#seekRange"),
    previousButton: $("#previousButton"),
    playPauseButton: $("#playPauseButton"),
    nextButton: $("#nextButton"),
    miniPlayButton: $("#miniPlayButton"),
    miniTitle: $("#miniTitle"),
    miniSub: $("#miniSub"),
    miniThumb: $("#miniThumb"),
    audioOnlyToggle: $("#audioOnlyToggle"),
    theaterToggle: $("#theaterToggle"),
    volumeRange: $("#volumeRange"),
    speedSelect: $("#speedSelect"),
    bassRange: $("#bassRange"),
    trebleRange: $("#trebleRange"),
    liveDot: $("#liveDot"),
    videoShell: $("#videoShell"),
    sleepStatus: $("#sleepStatus"),
    cancelSleepButton: $("#cancelSleepButton"),
    themeToggle: $("#themeToggle"),
    settingsButton: $("#settingsButton"),
    downloadModal: $("#downloadModal"),
    settingsModal: $("#settingsModal"),
    wakeLockToggle: $("#wakeLockToggle"),
    reducedMotionToggle: $("#reducedMotionToggle"),
    apiKeyInput: $("#apiKeyInput"),
    saveApiKeyButton: $("#saveApiKeyButton"),
    searchForm: $("#searchForm"),
    searchInput: $("#searchInput"),
    searchResults: $("#searchResults"),
    durationFilter: $("#durationFilter"),
    dateFilter: $("#dateFilter"),
    channelFilter: $("#channelFilter"),
    openYoutubeSearch: $("#openYoutubeSearch"),
    queueList: $("#queueList"),
    shuffleButton: $("#shuffleButton"),
    repeatButton: $("#repeatButton"),
    clearQueueButton: $("#clearQueueButton"),
    playlistSelect: $("#playlistSelect"),
    playlistNameInput: $("#playlistNameInput"),
    createPlaylistButton: $("#createPlaylistButton"),
    deletePlaylistButton: $("#deletePlaylistButton"),
    libraryGrid: $("#libraryGrid"),
    importButton: $("#importButton"),
    importFile: $("#importFile"),
    exportButton: $("#exportButton"),
    thumbnailButton: $("#thumbnailButton"),
    copyShinLinkButton: $("#copyShinLinkButton"),
    officialDownloadLink: $("#officialDownloadLink"),
    toastRegion: $("#toastRegion"),
    miniPlayer: $("#miniPlayer")
  };

  window.onYouTubeIframeAPIReady = function () {
    youtubeApiReady = true;
    if (state.current) createPlayer(state.current.id);
  };

  function createPlayer(videoId) {
    if (!youtubeApiReady || player) return;
    const playerConfig = {
      height: "390",
      width: "640",
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onReady: () => {
          playerReady = true;
          applyPlayerSettings();
          if (state.current) renderNowPlaying();
        },
        onStateChange: (event) => {
          playerState = event.data;
          updatePlayIcons();
          if (event.data === YT.PlayerState.PLAYING) {
            beginProgress();
            rememberHistory();
            setupMediaSession();
            requestWakeLock();
          }
          if (event.data === YT.PlayerState.ENDED) playNext(true);
        }
      }
    };
    player = new YT.Player("youtube-player", playerConfig);
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    hydrateStateShape();
    applyTheme();
    restoreControls();
    bindEvents();
    routeFromHash();
    renderAll();
    loadSharedUrl();
    registerServiceWorker();
    beginProgress();
  }

  function bindEvents() {
    window.addEventListener("hashchange", routeFromHash);
    document.addEventListener("keydown", handleKeys);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") requestWakeLock();
    });

    els.loadForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = itemFromInput(els.urlInput.value);
      if (!item) return toast("Paste a valid YouTube URL or video ID.");
      playItem(item, true);
    });

    els.addToQueueButton.addEventListener("click", () => {
      const item = itemFromInput(els.urlInput.value) || state.current;
      if (!item) return toast("Load or paste a video first.");
      addToQueue(item);
    });

    els.shareCurrentButton.addEventListener("click", () => copyShinPlayLink());
    els.downloadButton.addEventListener("click", () => openDownloadModal());
    els.previousButton.addEventListener("click", () => playPrevious());
    els.nextButton.addEventListener("click", () => playNext(false));
    els.playPauseButton.addEventListener("click", togglePlay);
    els.miniPlayButton.addEventListener("click", togglePlay);

    els.seekRange.addEventListener("input", () => {
      if (!playerReady || !player.getDuration) return;
      const duration = player.getDuration() || 0;
      player.seekTo((Number(els.seekRange.value) / 100) * duration, true);
    });

    els.audioOnlyToggle.addEventListener("change", () => {
      state.settings.audioOnly = els.audioOnlyToggle.checked;
      saveAndRender();
    });

    els.theaterToggle.addEventListener("change", () => {
      state.settings.theater = els.theaterToggle.checked;
      saveAndRender();
    });

    els.volumeRange.addEventListener("input", () => {
      state.settings.volume = Number(els.volumeRange.value);
      if (playerReady && player.setVolume) player.setVolume(state.settings.volume);
      saveState();
    });

    els.speedSelect.addEventListener("change", () => {
      state.settings.speed = Number(els.speedSelect.value);
      if (playerReady && player.setPlaybackRate) player.setPlaybackRate(state.settings.speed);
      saveState();
    });

    els.bassRange.addEventListener("input", () => {
      state.settings.bass = Number(els.bassRange.value);
      saveState();
    });

    els.trebleRange.addEventListener("input", () => {
      state.settings.treble = Number(els.trebleRange.value);
      saveState();
    });

    $$(".timer-buttons [data-sleep]").forEach((button) => {
      button.addEventListener("click", () => setSleepTimer(Number(button.dataset.sleep)));
    });
    els.cancelSleepButton.addEventListener("click", cancelSleepTimer);

    els.themeToggle.addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
      saveState();
    });

    els.settingsButton.addEventListener("click", () => els.settingsModal.showModal());
    els.wakeLockToggle.addEventListener("change", () => {
      state.settings.wakeLock = els.wakeLockToggle.checked;
      if (state.settings.wakeLock) requestWakeLock();
      else releaseWakeLock();
      saveState();
    });
    els.reducedMotionToggle.addEventListener("change", () => {
      state.settings.reduceMotion = els.reducedMotionToggle.checked;
      document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
      saveState();
    });

    els.saveApiKeyButton.addEventListener("click", () => {
      state.apiKey = els.apiKeyInput.value.trim();
      saveState();
      toast(state.apiKey ? "API key saved locally." : "API key cleared.");
    });

    els.searchForm.addEventListener("submit", searchYouTube);
    els.openYoutubeSearch.addEventListener("click", () => {
      const q = encodeURIComponent(els.searchInput.value.trim() || "music");
      window.open(`https://www.youtube.com/results?search_query=${q}`, "_blank", "noreferrer");
    });

    els.shuffleButton.addEventListener("click", shuffleQueue);
    els.repeatButton.addEventListener("click", cycleRepeat);
    els.clearQueueButton.addEventListener("click", clearQueue);
    els.playlistSelect.addEventListener("change", () => {
      state.activePlaylistId = els.playlistSelect.value;
      syncQueueFromPlaylist();
      saveAndRender();
    });
    els.createPlaylistButton.addEventListener("click", createPlaylist);
    els.deletePlaylistButton.addEventListener("click", deletePlaylist);

    $$(".tabs [data-library]").forEach((button) => {
      button.addEventListener("click", () => {
        activeLibrary = button.dataset.library;
        renderLibrary();
      });
    });

    els.importButton.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", importFile);
    els.exportButton.addEventListener("click", openDownloadModal);

    $$(".action-grid [data-download]").forEach((button) => {
      button.addEventListener("click", () => downloadExport(button.dataset.download));
    });
    els.thumbnailButton.addEventListener("click", downloadThumbnail);
    els.copyShinLinkButton.addEventListener("click", copyShinPlayLink);

    makeMiniPlayerDraggable();
  }

  function loadSharedUrl() {
    const params = new URLSearchParams(location.search);
    const id = parseYouTubeId(params.get("v"));
    const queue = params.get("q");
    if (queue) {
      const items = queue.split(",").map((videoId) => makeItem(videoId)).filter(Boolean);
      if (items.length) {
        state.queue = uniqueItems([...state.queue, ...items]);
        syncPlaylistFromQueue();
      }
    }
    if (id) playItem(makeItem(id), false);
  }

  function routeFromHash() {
    const route = (location.hash || "#player").replace("#", "");
    $$(".route").forEach((section) => section.classList.toggle("active", section.id === `route-${route}`));
    $$("[data-route]").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  }

  function itemFromInput(value) {
    const id = parseYouTubeId(value);
    return id ? makeItem(id) : null;
  }

  function parseYouTubeId(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
    try {
      const url = new URL(text);
      if (url.hostname.includes("youtu.be")) return cleanId(url.pathname.slice(1));
      if (url.searchParams.get("v")) return cleanId(url.searchParams.get("v"));
      if (url.pathname.includes("/shorts/")) return cleanId(url.pathname.split("/shorts/")[1]);
      if (url.pathname.includes("/embed/")) return cleanId(url.pathname.split("/embed/")[1]);
      if (url.pathname.includes("/live/")) return cleanId(url.pathname.split("/live/")[1]);
    } catch (error) {
      return "";
    }
    return "";
  }

  function cleanId(value) {
    return String(value || "").split(/[?&#/]/)[0].slice(0, 11);
  }

  function makeItem(id, extras = {}) {
    if (!id) return null;
    return {
      id,
      title: extras.title || `YouTube video ${id}`,
      channel: extras.channel || "YouTube",
      description: extras.description || "",
      addedAt: extras.addedAt || new Date().toISOString(),
      thumbnail: extras.thumbnail || thumbnailUrl(id)
    };
  }

  function thumbnailUrl(id, quality = "hqdefault") {
    return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
  }

  function playItem(item, addHistory) {
    state.current = normalizeItem(item);
    const index = state.queue.findIndex((entry) => entry.id === state.current.id);
    state.currentIndex = index;
    if (youtubeApiReady && !player) {
      createPlayer(state.current.id);
    } else if (playerReady && player.loadVideoById) {
      player.loadVideoById(state.current.id);
      player.setVolume(state.settings.volume);
      player.setPlaybackRate(state.settings.speed);
    }
    if (addHistory) rememberHistory();
    saveAndRender();
  }

  function togglePlay() {
    if (!playerReady) {
      if (state.current) toast("Player is still loading.");
      else toast("Load a video first.");
      return;
    }
    if (playerState === YT.PlayerState.PLAYING) player.pauseVideo();
    else {
      if (state.current) player.playVideo();
      else toast("Load a video first.");
    }
  }

  function playNext(fromEnded) {
    if (!state.queue.length) {
      if (fromEnded && state.repeat === "one" && state.current) playItem(state.current, false);
      return;
    }
    if (state.repeat === "one" && state.current) {
      playItem(state.current, false);
      return;
    }
    const nextIndex = state.currentIndex + 1;
    if (nextIndex < state.queue.length) {
      playItem(state.queue[nextIndex], true);
    } else if (state.repeat === "all") {
      playItem(state.queue[0], true);
    }
  }

  function playPrevious() {
    if (!state.queue.length) return;
    const prevIndex = Math.max(0, state.currentIndex - 1);
    playItem(state.queue[prevIndex], true);
  }

  function addToQueue(item, silent) {
    const normalized = normalizeItem(item);
    state.queue.push(normalized);
    syncPlaylistFromQueue();
    if (!state.current) playItem(normalized, false);
    saveAndRender();
    if (!silent) toast("Added to queue.");
  }

  function removeFromQueue(index) {
    const [removed] = state.queue.splice(index, 1);
    lastRemoved = { item: removed, index };
    syncPlaylistFromQueue();
    if (state.current && removed.id === state.current.id) {
      state.currentIndex = -1;
    }
    saveAndRender();
    toast("Removed from queue.", {
      label: "Undo",
      action: () => {
        state.queue.splice(lastRemoved.index, 0, lastRemoved.item);
        syncPlaylistFromQueue();
        saveAndRender();
      }
    });
  }

  function moveQueue(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.queue.length) return;
    const [item] = state.queue.splice(index, 1);
    state.queue.splice(target, 0, item);
    syncPlaylistFromQueue();
    state.currentIndex = state.current ? state.queue.findIndex((entry) => entry.id === state.current.id) : -1;
    saveAndRender();
  }

  function shuffleQueue() {
    for (let index = state.queue.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [state.queue[index], state.queue[swap]] = [state.queue[swap], state.queue[index]];
    }
    syncPlaylistFromQueue();
    state.currentIndex = state.current ? state.queue.findIndex((entry) => entry.id === state.current.id) : -1;
    saveAndRender();
    toast("Queue shuffled.");
  }

  function cycleRepeat() {
    state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
    saveAndRender();
  }

  function clearQueue() {
    if (!state.queue.length) return;
    state.queue = [];
    state.currentIndex = -1;
    syncPlaylistFromQueue();
    saveAndRender();
    toast("Queue cleared.");
  }

  function rememberHistory() {
    if (!state.current) return;
    const item = { ...normalizeItem(state.current), playedAt: new Date().toISOString() };
    state.history = [item, ...state.history.filter((entry) => entry.id !== item.id)].slice(0, 100);
    saveState();
    renderLibrary();
  }

  function toggleFavorite(item) {
    const exists = state.favorites.some((entry) => entry.id === item.id);
    if (exists) state.favorites = state.favorites.filter((entry) => entry.id !== item.id);
    else state.favorites.unshift(normalizeItem(item));
    saveAndRender();
    toast(exists ? "Removed from favorites." : "Added to favorites.");
  }

  function syncPlaylistFromQueue() {
    const playlist = getActivePlaylist();
    if (playlist) playlist.items = [...state.queue];
  }

  function syncQueueFromPlaylist() {
    const playlist = getActivePlaylist();
    state.queue = playlist ? [...playlist.items] : [];
    state.currentIndex = state.current ? state.queue.findIndex((entry) => entry.id === state.current.id) : -1;
  }

  function getActivePlaylist() {
    return state.playlists.find((playlist) => playlist.id === state.activePlaylistId) || state.playlists[0];
  }

  function createPlaylist() {
    const name = els.playlistNameInput.value.trim();
    if (!name) return toast("Enter a playlist name.");
    const playlist = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, items: [] };
    state.playlists.push(playlist);
    state.activePlaylistId = playlist.id;
    state.queue = [];
    els.playlistNameInput.value = "";
    saveAndRender();
  }

  function deletePlaylist() {
    if (state.playlists.length === 1) return toast("Keep at least one playlist.");
    state.playlists = state.playlists.filter((playlist) => playlist.id !== state.activePlaylistId);
    state.activePlaylistId = state.playlists[0].id;
    syncQueueFromPlaylist();
    saveAndRender();
  }

  async function searchYouTube(event) {
    event.preventDefault();
    const q = els.searchInput.value.trim();
    if (!q) return toast("Enter a search query.");
    if (!state.apiKey) return toast("Save your YouTube Data API key first, or open YouTube search.");

    const params = new URLSearchParams({
      key: state.apiKey,
      part: "snippet",
      type: "video",
      maxResults: "12",
      q
    });
    if (els.durationFilter.value) params.set("videoDuration", els.durationFilter.value);
    if (els.channelFilter.value.trim()) params.set("channelId", els.channelFilter.value.trim());
    const after = publishedAfter(els.dateFilter.value);
    if (after) params.set("publishedAfter", after);

    els.searchResults.innerHTML = emptyState("Searching", "Looking for matching videos.");
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ? data.error.message : "Search failed");
      const items = data.items.map((entry) =>
        makeItem(entry.id.videoId, {
          title: decodeText(entry.snippet.title),
          channel: decodeText(entry.snippet.channelTitle),
          description: decodeText(entry.snippet.description),
          thumbnail: entry.snippet.thumbnails.high?.url || thumbnailUrl(entry.id.videoId)
        })
      );
      renderCards(els.searchResults, items, "No results", "Try another search term or filter.");
    } catch (error) {
      els.searchResults.innerHTML = emptyState("Search unavailable", error.message || "Check your key and network connection.");
    }
  }

  function publishedAfter(filter) {
    if (!filter) return "";
    const date = new Date();
    if (filter === "today") date.setDate(date.getDate() - 1);
    if (filter === "week") date.setDate(date.getDate() - 7);
    if (filter === "month") date.setMonth(date.getMonth() - 1);
    if (filter === "year") date.setFullYear(date.getFullYear() - 1);
    return date.toISOString();
  }

  function decodeText(text) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text || "";
    return textarea.value;
  }

  function renderAll() {
    renderNowPlaying();
    renderQueue();
    renderPlaylists();
    renderLibrary();
    applyToggles();
    updatePlayIcons();
    els.repeatButton.querySelector("span").textContent = `Repeat ${state.repeat}`;
  }

  function renderNowPlaying() {
    const item = state.current;
    const thumb = item ? item.thumbnail : "./assets/logo.png";
    els.currentThumb.src = thumb;
    els.miniThumb.src = thumb;
    els.nowTitle.textContent = item ? item.title : "Paste a link to start";
    els.nowMeta.textContent = item ? `${item.channel} - ${youtubeUrl(item.id)}` : "Your queue, favorites, and history stay on this device.";
    els.miniTitle.textContent = item ? item.title : "Nothing playing";
    els.miniSub.textContent = item ? item.channel : "Ready";
    els.playerStatus.textContent = item ? "Loaded" : "Ready";
    els.officialDownloadLink.href = item ? youtubeUrl(item.id) : "https://www.youtube.com/premium";
  }

  function renderQueue() {
    if (!state.queue.length) {
      els.queueList.innerHTML = emptyState("Queue is empty", "Paste a link or add a search result.");
      return;
    }
    els.queueList.innerHTML = state.queue
      .map((item, index) => {
        const active = state.current && state.current.id === item.id ? "Now playing" : `Track ${index + 1}`;
        return `
          <article class="queue-item">
            <img class="queue-thumb" src="${escapeAttr(item.thumbnail)}" alt="">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(active)} - ${escapeHtml(item.channel)}</p>
            </div>
            <div class="queue-actions">
              <button class="icon-button small" type="button" data-queue-play="${index}" aria-label="Play ${escapeAttr(item.title)}"><svg><use href="#i-play"></use></svg></button>
              <button class="icon-button small" type="button" data-queue-up="${index}" aria-label="Move up"><svg><use href="#i-arrow-up"></use></svg></button>
              <button class="icon-button small" type="button" data-queue-down="${index}" aria-label="Move down"><svg><use href="#i-arrow-down"></use></svg></button>
              <button class="icon-button small" type="button" data-queue-fav="${index}" aria-label="Toggle favorite"><svg><use href="#i-heart"></use></svg></button>
              <button class="icon-button small" type="button" data-queue-remove="${index}" aria-label="Remove"><svg><use href="#i-trash"></use></svg></button>
            </div>
          </article>
        `;
      })
      .join("");
    els.queueList.querySelectorAll("[data-queue-play]").forEach((button) => button.addEventListener("click", () => playItem(state.queue[Number(button.dataset.queuePlay)], true)));
    els.queueList.querySelectorAll("[data-queue-up]").forEach((button) => button.addEventListener("click", () => moveQueue(Number(button.dataset.queueUp), -1)));
    els.queueList.querySelectorAll("[data-queue-down]").forEach((button) => button.addEventListener("click", () => moveQueue(Number(button.dataset.queueDown), 1)));
    els.queueList.querySelectorAll("[data-queue-fav]").forEach((button) => button.addEventListener("click", () => toggleFavorite(state.queue[Number(button.dataset.queueFav)])));
    els.queueList.querySelectorAll("[data-queue-remove]").forEach((button) => button.addEventListener("click", () => removeFromQueue(Number(button.dataset.queueRemove))));
  }

  function renderPlaylists() {
    els.playlistSelect.innerHTML = state.playlists
      .map((playlist) => `<option value="${escapeAttr(playlist.id)}">${escapeHtml(playlist.name)} (${playlist.items.length})</option>`)
      .join("");
    els.playlistSelect.value = state.activePlaylistId;
  }

  function renderLibrary() {
    $$(".tabs [data-library]").forEach((button) => {
      const active = button.dataset.library === activeLibrary;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const items = activeLibrary === "favorites" ? state.favorites : state.history;
    renderCards(els.libraryGrid, items, activeLibrary === "favorites" ? "No favorites yet" : "History is empty", "Play a video and it will appear here.");
  }

  function renderCards(container, items, emptyTitle, emptyBody) {
    if (!items.length) {
      container.innerHTML = emptyState(emptyTitle, emptyBody);
      return;
    }
    container.innerHTML = items
      .map((item) => `
        <article class="media-card">
          <img src="${escapeAttr(item.thumbnail)}" alt="">
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.channel)}</p>
          </div>
          <div class="card-actions">
            <button class="ghost-button" type="button" data-card-play="${escapeAttr(item.id)}" aria-label="Play ${escapeAttr(item.title)}"><svg><use href="#i-play"></use></svg></button>
            <button class="ghost-button" type="button" data-card-add="${escapeAttr(item.id)}" aria-label="Add to queue"><svg><use href="#i-add"></use></svg></button>
            <button class="ghost-button" type="button" data-card-fav="${escapeAttr(item.id)}" aria-label="Toggle favorite"><svg><use href="#i-heart"></use></svg></button>
          </div>
        </article>
      `)
      .join("");
    container.querySelectorAll("[data-card-play]").forEach((button) => button.addEventListener("click", () => playItem(findRenderedItem(items, button.dataset.cardPlay), true)));
    container.querySelectorAll("[data-card-add]").forEach((button) => button.addEventListener("click", () => addToQueue(findRenderedItem(items, button.dataset.cardAdd))));
    container.querySelectorAll("[data-card-fav]").forEach((button) => button.addEventListener("click", () => toggleFavorite(findRenderedItem(items, button.dataset.cardFav))));
  }

  function findRenderedItem(items, id) {
    return items.find((item) => item.id === id) || makeItem(id);
  }

  function emptyState(title, body) {
    return `
      <div class="empty-state glass">
        <svg aria-hidden="true"><use href="#i-music"></use></svg>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">${escapeHtml(body)}</p>
      </div>
    `;
  }

  function applyToggles() {
    els.audioOnlyToggle.checked = Boolean(state.settings.audioOnly);
    els.theaterToggle.checked = Boolean(state.settings.theater);
    els.wakeLockToggle.checked = Boolean(state.settings.wakeLock);
    els.reducedMotionToggle.checked = Boolean(state.settings.reduceMotion);
    els.videoShell.classList.toggle("audio-only", state.settings.audioOnly);
    document.body.classList.toggle("theater-mode", state.settings.theater);
    document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
  }

  function restoreControls() {
    els.apiKeyInput.value = state.apiKey || "";
    els.volumeRange.value = state.settings.volume;
    els.speedSelect.value = String(state.settings.speed);
    els.bassRange.value = state.settings.bass;
    els.trebleRange.value = state.settings.treble;
  }

  function applyPlayerSettings() {
    if (!playerReady) return;
    if (player.setVolume) player.setVolume(state.settings.volume);
    if (player.setPlaybackRate) player.setPlaybackRate(state.settings.speed);
  }

  function beginProgress() {
    clearInterval(progressTimer);
    progressTimer = setInterval(updateProgress, 700);
    updateProgress();
  }

  function updateProgress() {
    if (!playerReady || !player.getCurrentTime || !player.getDuration) return;
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    els.elapsedTime.textContent = formatTime(current);
    els.durationTime.textContent = formatTime(duration);
    els.seekRange.value = duration ? String((current / duration) * 100) : "0";
    els.liveDot.hidden = !(duration === 0 && playerState === YT.PlayerState.PLAYING);
  }

  function updatePlayIcons() {
    const use = playerState === 1 ? "#i-pause" : "#i-play";
    [els.playPauseButton, els.miniPlayButton].forEach((button) => {
      button.setAttribute("aria-label", playerState === 1 ? "Pause" : "Play");
      button.querySelector("use").setAttribute("href", use);
    });
  }

  function setSleepTimer(minutes) {
    cancelSleepTimer(false);
    const ms = minutes * 60 * 1000;
    const fadeStart = Math.max(0, ms - 15000);
    const originalVolume = state.settings.volume;
    sleepFadeTimer = setTimeout(() => fadeVolume(originalVolume), fadeStart);
    sleepTimer = setTimeout(() => {
      if (playerReady && player.pauseVideo) player.pauseVideo();
      state.settings.volume = originalVolume;
      els.volumeRange.value = originalVolume;
      if (playerReady && player.setVolume) player.setVolume(originalVolume);
      cancelSleepTimer(false);
      toast("Sleep timer finished.");
    }, ms);
    els.sleepStatus.textContent = `Timer set for ${minutes} minutes.`;
    toast(`Sleep timer set for ${minutes} minutes.`);
  }

  function fadeVolume(originalVolume) {
    let steps = 15;
    const interval = setInterval(() => {
      steps -= 1;
      const next = Math.max(0, Math.round((originalVolume * steps) / 15));
      if (playerReady && player.setVolume) player.setVolume(next);
      if (steps <= 0) clearInterval(interval);
    }, 1000);
  }

  function cancelSleepTimer(showToast = true) {
    clearTimeout(sleepTimer);
    clearTimeout(sleepFadeTimer);
    sleepTimer = 0;
    sleepFadeTimer = 0;
    els.sleepStatus.textContent = "No timer set.";
    if (showToast) toast("Sleep timer cancelled.");
  }

  function openDownloadModal() {
    renderNowPlaying();
    els.downloadModal.showModal();
  }

  function downloadExport(format) {
    const items = exportItems();
    if (!items.length) return toast("Nothing to export yet.");
    if (format === "json") {
      saveBlob(JSON.stringify({ exportedAt: new Date().toISOString(), queue: state.queue, favorites: state.favorites, history: state.history, playlists: state.playlists }, null, 2), "shinplay-library.json", "application/json");
    }
    if (format === "m3u") {
      const body = ["#EXTM3U", ...items.map((item) => `#EXTINF:-1,${item.title}\n${youtubeUrl(item.id)}`)].join("\n");
      saveBlob(body, "shinplay-playlist.m3u", "audio/x-mpegurl");
    }
    if (format === "csv") {
      const rows = [["title", "channel", "url"], ...items.map((item) => [item.title, item.channel, youtubeUrl(item.id)])];
      saveBlob(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "shinplay-library.csv", "text/csv");
    }
  }

  function exportItems() {
    return uniqueItems([state.current, ...state.queue, ...state.favorites, ...state.history].filter(Boolean));
  }

  async function downloadThumbnail() {
    if (!state.current) return toast("Load a video first.");
    const candidates = [thumbnailUrl(state.current.id, "maxresdefault"), thumbnailUrl(state.current.id, "hqdefault")];
    for (const url of candidates) {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) continue;
        const blob = await response.blob();
        saveBlob(blob, `${state.current.id}-thumbnail.jpg`, "image/jpeg");
        return;
      } catch (error) {
        continue;
      }
    }
    window.open(thumbnailUrl(state.current.id), "_blank", "noreferrer");
    toast("Thumbnail opened in a new tab.");
  }

  function copyShinPlayLink() {
    const ids = uniqueItems([state.current, ...state.queue].filter(Boolean)).map((item) => item.id);
    if (!ids.length) return toast("Load or queue a video first.");
    const url = new URL(location.href);
    url.hash = "#player";
    url.search = "";
    url.searchParams.set("v", ids[0]);
    if (ids.length > 1) url.searchParams.set("q", ids.join(","));
    copyText(url.toString());
    toast("ShinPlay link copied.");
  }

  function saveBlob(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvCell(value) {
    return `"${String(value || "").replace(/"/g, '""')}"`;
  }

  function importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const imported = parseImport(text, file.name);
        if (!imported.length) return toast("No YouTube links found in that file.");
        state.queue = uniqueItems([...state.queue, ...imported]);
        syncPlaylistFromQueue();
        saveAndRender();
        toast(`Imported ${imported.length} item${imported.length === 1 ? "" : "s"}.`);
      } catch (error) {
        toast("Import failed. Check the file format.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function parseImport(text, name) {
    if (name.endsWith(".json")) {
      const data = JSON.parse(text);
      const items = [...(data.queue || []), ...(data.favorites || []), ...(data.history || [])];
      if (Array.isArray(data.playlists)) items.push(...data.playlists.flatMap((playlist) => playlist.items || []));
      return items.map(normalizeItem).filter(Boolean);
    }
    return text
      .split(/\r?\n/)
      .map((line) => parseYouTubeId(line))
      .filter(Boolean)
      .map((id) => makeItem(id));
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator) || !state.current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.current.title,
      artist: state.current.channel,
      album: "ShinPlay",
      artwork: [
        { src: thumbnailUrl(state.current.id), sizes: "480x360", type: "image/jpeg" },
        { src: "./assets/icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    });
    navigator.mediaSession.setActionHandler("play", () => playerReady && player.playVideo());
    navigator.mediaSession.setActionHandler("pause", () => playerReady && player.pauseVideo());
    navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", () => playNext(false));
    navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => seekBy(10));
  }

  function seekBy(seconds) {
    if (!playerReady || !player.getCurrentTime) return;
    player.seekTo(Math.max(0, player.getCurrentTime() + seconds), true);
  }

  async function requestWakeLock() {
    if (!state.settings.wakeLock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch (error) {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    if (wakeLock) await wakeLock.release();
    wakeLock = null;
  }

  function applyTheme() {
    document.body.classList.toggle("dark-theme", state.theme === "dark");
    els.themeToggle.querySelector("use").setAttribute("href", state.theme === "dark" ? "#i-sun" : "#i-moon");
    els.themeToggle.setAttribute("aria-label", state.theme === "dark" ? "Use light theme" : "Use dark theme");
  }

  function handleKeys(event) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
    }
    if (event.shiftKey && event.code === "ArrowRight") playNext(false);
    if (event.shiftKey && event.code === "ArrowLeft") playPrevious();
    if (event.key === "?") els.settingsModal.showModal();
  }

  function makeMiniPlayerDraggable() {
    els.miniPlayer.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      miniDrag = {
        startX: event.clientX,
        startY: event.clientY,
        rect: els.miniPlayer.getBoundingClientRect()
      };
      els.miniPlayer.setPointerCapture(event.pointerId);
    });
    els.miniPlayer.addEventListener("pointermove", (event) => {
      if (!miniDrag) return;
      const nextLeft = Math.min(window.innerWidth - miniDrag.rect.width - 8, Math.max(8, miniDrag.rect.left + event.clientX - miniDrag.startX));
      const nextTop = Math.min(window.innerHeight - miniDrag.rect.height - 8, Math.max(8, miniDrag.rect.top + event.clientY - miniDrag.startY));
      els.miniPlayer.style.left = `${nextLeft}px`;
      els.miniPlayer.style.top = `${nextTop}px`;
      els.miniPlayer.style.right = "auto";
      els.miniPlayer.style.bottom = "auto";
    });
    els.miniPlayer.addEventListener("pointerup", () => {
      miniDrag = null;
    });
  }

  function toast(message, action) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    if (action) {
      const button = document.createElement("button");
      button.className = "ghost-button";
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        action.action();
        node.remove();
      });
      node.append(" ", button);
    }
    els.toastRegion.append(node);
    setTimeout(() => node.remove(), 4200);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text);
    else {
      const input = document.createElement("input");
      input.value = text;
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function youtubeUrl(id) {
    return `https://www.youtube.com/watch?v=${id}`;
  }

  function normalizeItem(item) {
    if (!item || !item.id) return null;
    return makeItem(item.id, item);
  }

  function uniqueItems(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function saveAndRender() {
    saveState();
    renderAll();
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved ? merge(initialState, saved) : structuredClone(initialState);
    } catch (error) {
      return structuredClone(initialState);
    }
  }

  function hydrateStateShape() {
    state.playlists = state.playlists && state.playlists.length ? state.playlists : [{ id: "default", name: "Main queue", items: state.queue || [] }];
    state.activePlaylistId = state.activePlaylistId || state.playlists[0].id;
    if (!state.queue.length) syncQueueFromPlaylist();
  }

  function merge(base, saved) {
    const copy = structuredClone(base);
    Object.assign(copy, saved);
    copy.settings = { ...base.settings, ...(saved.settings || {}) };
    return copy;
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }
})();
