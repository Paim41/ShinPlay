// ═══════════════════════════════════════════════════════
//  SHINPLAY — STATE
// ═══════════════════════════════════════════════════════
let player;
let deferredInstallPrompt = null;
let sleepTimeoutId = null;
let sleepEndsAt = null;

let playerState = {
    isAudioMode: false,
    isMiniPlayer: false,
    isTheater: false,
    currentVideoId: null,
    currentVideoTitle: null,
    currentVideoChannel: null,
    playlist: [],           // { videoId, title }
    currentPlaylistIndex: -1,
    wasPlayingBeforeSleep: false,
    shuffle: false,
    repeat: 'off',           // 'off' | 'all' | 'one'
    playbackRate: 1,
    volume: 70,
    favorites: [],           // { videoId, title }
    history: [],             // { videoId, title, ts }
    apiKey: '',
    theme: 'dark'
};

// ═══════════════════════════════════════════════════════
//  YOUTUBE PLAYER
// ═══════════════════════════════════════════════════════
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'playsinline': 1,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    document.getElementById('playPauseBtn').disabled = false;
    document.getElementById('progressBar').disabled = false;
    loadFromLocalStorage();
    player.setVolume(playerState.volume);
    if (playerState.playbackRate && playerState.playbackRate !== 1) {
        try { player.setPlaybackRate(playerState.playbackRate); } catch (e) {}
    }
    setInterval(updateProgress, 1000);
    lucide.createIcons();
    setupMediaSession();
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        if (playerState.repeat === 'one') {
            player.seekTo(0, true);
            player.playVideo();
        } else {
            playNext();
        }
    }
    updatePlayPauseButton();
    updateWaveform();
    updateLiveDot();
    updateMediaSessionState();

    if (event.data === YT.PlayerState.PLAYING) {
        requestWakeLock();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        releaseWakeLock();
    }
}

function extractVideoId(input) {
    input = input.trim();
    if (input.length === 11 && !input.includes('/') && !input.includes('?')) {
        return input;
    }
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function thumbUrl(videoId, quality) {
    return `https://i.ytimg.com/vi/${videoId}/${quality || 'mqdefault'}.jpg`;
}

function loadVideo(videoId, knownTitle) {
    if (!videoId) return;
    playerState.currentVideoId = videoId;
    player.loadVideoById(videoId);
    if (playerState.playbackRate && playerState.playbackRate !== 1) {
        setTimeout(() => { try { player.setPlaybackRate(playerState.playbackRate); } catch (e) {} }, 300);
    }
    setTimeout(() => {
        updateVideoTitle(knownTitle);
        addToHistory(videoId, playerState.currentVideoTitle || knownTitle || videoId);
    }, 900);
    saveToLocalStorage();
}

function updateVideoTitle(knownTitle) {
    try {
        const videoData = player.getVideoData();
        const title = videoData.title || knownTitle || 'Playing video';
        const author = videoData.author || '';
        playerState.currentVideoTitle = title;
        playerState.currentVideoChannel = author;
        document.getElementById('videoTitle').textContent = title;
        document.getElementById('videoChannel').textContent = author ? author : 'Now playing';
        document.getElementById('audioTitle').textContent = title;
        document.getElementById('miniTitle').textContent = title;
        updateFavButtonState();
        updateMediaSessionMetadata();
    } catch (e) {
        document.getElementById('videoTitle').textContent = knownTitle || 'Playing video';
        document.getElementById('videoChannel').textContent = 'Loading…';
    }
}

function togglePlayPause() {
    if (!player || !player.getPlayerState) return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function updatePlayPauseButton() {
    if (!player || !player.getPlayerState) return;
    const state = player.getPlayerState();
    const isPlaying = state === YT.PlayerState.PLAYING;
    const playPauseIcon = document.getElementById('playPauseIcon');
    const miniPlayBtn = document.getElementById('miniPlayBtn');

    if (isPlaying) {
        playPauseIcon.setAttribute('data-lucide', 'pause');
        miniPlayBtn.innerHTML = '<i data-lucide="pause"></i>';
    } else {
        playPauseIcon.setAttribute('data-lucide', 'play');
        miniPlayBtn.innerHTML = '<i data-lucide="play"></i>';
    }
    lucide.createIcons();
}

function updateWaveform() {
    if (!player || !player.getPlayerState) return;
    const isPlaying = player.getPlayerState() === YT.PlayerState.PLAYING;
    const waveform = document.getElementById('waveformContainer');
    if (!waveform) return;
    waveform.classList.toggle('playing', isPlaying);
}

function updateLiveDot() {
    if (!player || !player.getPlayerState) return;
    const isPlaying = player.getPlayerState() === YT.PlayerState.PLAYING;
    const dot = document.getElementById('liveDot');
    if (!dot) return;
    dot.classList.toggle('visible', isPlaying);
}

function updateProgress() {
    if (!player || !player.getCurrentTime) return;
    try {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            document.getElementById('progressBar').value = progress;
            document.getElementById('miniProgressFill').style.width = progress + '%';
            document.getElementById('currentTime').textContent = formatTime(currentTime);
            document.getElementById('duration').textContent = formatTime(duration);
            updateMediaSessionPosition(currentTime, duration);
        }
    } catch (e) {}
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekTo(percentage) {
    if (!player || !player.getDuration) return;
    const duration = player.getDuration();
    const seekTime = (percentage / 100) * duration;
    player.seekTo(seekTime, true);
}

function setVolume(volume) {
    if (!player || !player.setVolume) return;
    playerState.volume = Number(volume);
    player.setVolume(volume);
    updateMuteButton();
    saveToLocalStorage();
}

function toggleMute() {
    if (!player) return;
    if (player.isMuted()) { player.unMute(); } else { player.mute(); }
    updateMuteButton();
}

function updateMuteButton() {
    if (!player) return;
    const isMuted = player.isMuted();
    const volume = player.getVolume();
    const muteBtn = document.getElementById('muteBtn');
    if (isMuted || volume === 0) {
        muteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
    } else if (volume < 50) {
        muteBtn.innerHTML = '<i data-lucide="volume-1"></i>';
    } else {
        muteBtn.innerHTML = '<i data-lucide="volume-2"></i>';
    }
    lucide.createIcons();
}

function toggleAudioMode() {
    playerState.isAudioMode = !playerState.isAudioMode;
    document.getElementById('audioOverlay').classList.toggle('active', playerState.isAudioMode);
    document.getElementById('audioModeBtn').classList.toggle('active', playerState.isAudioMode);
    saveToLocalStorage();
}

function toggleMiniPlayer() {
    playerState.isMiniPlayer = !playerState.isMiniPlayer;
    document.getElementById('miniPlayer').classList.toggle('active', playerState.isMiniPlayer);
    document.getElementById('miniPlayerBtn').classList.toggle('active', playerState.isMiniPlayer);
    if (playerState.isMiniPlayer) updateVideoTitle();
    saveToLocalStorage();
}

function closeMiniPlayer() {
    playerState.isMiniPlayer = false;
    document.getElementById('miniPlayer').classList.remove('active');
    document.getElementById('miniPlayerBtn').classList.remove('active');
    saveToLocalStorage();
}

function toggleTheater() {
    playerState.isTheater = !playerState.isTheater;
    document.querySelector('.app-shell').classList.toggle('theater-mode', playerState.isTheater);
    const icon = document.querySelector('#theaterBtn i');
    icon.setAttribute('data-lucide', playerState.isTheater ? 'minimize' : 'maximize');
    lucide.createIcons();
}

async function enablePictureInPicture() {
    try {
        const iframe = document.querySelector('#player');
        if (!iframe) return;
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (iframe.requestPictureInPicture) {
            await iframe.requestPictureInPicture();
        } else {
            showToast('Picture-in-Picture is not supported in this browser');
        }
    } catch (error) {
        showToast('Could not enable Picture-in-Picture. Try playing a video first.');
    }
}

// ═══════════════════════════════════════════════════════
//  SHUFFLE / REPEAT
// ═══════════════════════════════════════════════════════
function toggleShuffle() {
    playerState.shuffle = !playerState.shuffle;
    document.getElementById('shuffleBtn').classList.toggle('active', playerState.shuffle);
    showToast(playerState.shuffle ? 'Shuffle on' : 'Shuffle off');
    saveToLocalStorage();
}

function cycleRepeat() {
    const order = ['off', 'all', 'one'];
    const next = order[(order.indexOf(playerState.repeat) + 1) % order.length];
    playerState.repeat = next;
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active', next !== 'off');
    btn.innerHTML = next === 'one' ? '<i data-lucide="repeat-1"></i>' : '<i data-lucide="repeat"></i>';
    lucide.createIcons();
    showToast(next === 'off' ? 'Repeat off' : next === 'all' ? 'Repeat queue' : 'Repeat one');
    saveToLocalStorage();
}

// ═══════════════════════════════════════════════════════
//  PLAYBACK SPEED
// ═══════════════════════════════════════════════════════
function setPlaybackRate(rate) {
    playerState.playbackRate = rate;
    try { player.setPlaybackRate(rate); } catch (e) {}
    document.getElementById('speedBtn').textContent = rate + 'x';
    document.querySelectorAll('#speedOptions button').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.rate) === rate);
    });
    hidePopovers();
    saveToLocalStorage();
}

// ═══════════════════════════════════════════════════════
//  SLEEP TIMER
// ═══════════════════════════════════════════════════════
function setSleepTimer(minutes) {
    if (sleepTimeoutId) { clearTimeout(sleepTimeoutId); sleepTimeoutId = null; }
    document.querySelectorAll('#sleepOptions button').forEach(b => b.classList.remove('active'));
    if (!minutes) {
        sleepEndsAt = null;
        document.getElementById('sleepBtn').classList.remove('active');
        hidePopovers();
        showToast('Sleep timer off');
        return;
    }
    sleepEndsAt = Date.now() + minutes * 60 * 1000;
    document.querySelector(`#sleepOptions button[data-min="${minutes}"]`).classList.add('active');
    document.getElementById('sleepBtn').classList.add('active');
    sleepTimeoutId = setTimeout(() => {
        if (player && player.pauseVideo) player.pauseVideo();
        showToast('Sleep timer ended — playback paused');
        document.getElementById('sleepBtn').classList.remove('active');
        sleepEndsAt = null;
    }, minutes * 60 * 1000);
    hidePopovers();
    showToast(`Sleep timer set for ${minutes} min`);
}

// ═══════════════════════════════════════════════════════
//  QUEUE
// ═══════════════════════════════════════════════════════
function addToPlaylist(input, knownTitle) {
    const videoId = extractVideoId(input);
    if (!videoId) { showToast('Invalid YouTube URL or Video ID'); return; }
    if (playerState.playlist.some(item => item.videoId === videoId)) {
        showToast('Already in queue');
        return;
    }
    playerState.playlist.push({ videoId, title: knownTitle || videoId });
    renderPlaylist();
    saveToLocalStorage();
    document.getElementById('addVideoInput').value = '';
    showToast('Added to queue');
}

function removeFromPlaylist(index) {
    playerState.playlist.splice(index, 1);
    if (playerState.currentPlaylistIndex >= index && playerState.currentPlaylistIndex > 0) {
        playerState.currentPlaylistIndex--;
    }
    renderPlaylist();
    saveToLocalStorage();
}

function playFromPlaylist(index) {
    if (index < 0 || index >= playerState.playlist.length) return;
    playerState.currentPlaylistIndex = index;
    const item = playerState.playlist[index];
    loadVideo(item.videoId, item.title);
    renderPlaylist();
}

function playNext() {
    if (playerState.playlist.length === 0) return;
    let nextIndex;
    if (playerState.shuffle) {
        if (playerState.playlist.length === 1) { nextIndex = 0; }
        else {
            do { nextIndex = Math.floor(Math.random() * playerState.playlist.length); }
            while (nextIndex === playerState.currentPlaylistIndex);
        }
    } else {
        nextIndex = playerState.currentPlaylistIndex + 1;
        if (nextIndex >= playerState.playlist.length) {
            if (playerState.repeat === 'all') nextIndex = 0;
            else return;
        }
    }
    playFromPlaylist(nextIndex);
}

function playPrevious() {
    if (playerState.playlist.length === 0) return;
    const prevIndex = playerState.currentPlaylistIndex <= 0
        ? playerState.playlist.length - 1
        : playerState.currentPlaylistIndex - 1;
    playFromPlaylist(prevIndex);
}

function clearPlaylist() {
    if (playerState.playlist.length === 0) return;
    if (confirm('Clear entire queue?')) {
        playerState.playlist = [];
        playerState.currentPlaylistIndex = -1;
        renderPlaylist();
        saveToLocalStorage();
    }
}

function renderPlaylist() {
    const container = document.getElementById('playlistItems');
    document.getElementById('queueCount').textContent = playerState.playlist.length;
    container.innerHTML = '';

    if (playerState.playlist.length === 0) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="list-music"></i><p>Queue is empty</p></div>`;
        lucide.createIcons();
        return;
    }

    playerState.playlist.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'playlist-item' + (index === playerState.currentPlaylistIndex ? ' active' : '');
        div.innerHTML = `
            <div class="playlist-item-thumbnail"><img src="${thumbUrl(item.videoId, 'default')}" alt="" loading="lazy"></div>
            <div class="playlist-item-info"><div class="playlist-item-title">${escapeHtml(item.title)}</div></div>
            <button class="playlist-item-remove" title="Remove"><i data-lucide="x"></i></button>
        `;
        div.querySelector('.playlist-item-remove').onclick = (e) => { e.stopPropagation(); removeFromPlaylist(index); };
        div.onclick = () => playFromPlaylist(index);
        container.appendChild(div);
    });
    lucide.createIcons();
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
}

// ═══════════════════════════════════════════════════════
//  FAVORITES / HISTORY (Library)
// ═══════════════════════════════════════════════════════
function isFavorite(videoId) {
    return playerState.favorites.some(f => f.videoId === videoId);
}

function toggleFavoriteCurrent() {
    if (!playerState.currentVideoId) { showToast('Nothing playing yet'); return; }
    const id = playerState.currentVideoId;
    if (isFavorite(id)) {
        playerState.favorites = playerState.favorites.filter(f => f.videoId !== id);
        showToast('Removed from favorites');
    } else {
        playerState.favorites.unshift({ videoId: id, title: playerState.currentVideoTitle || id });
        showToast('Saved to favorites');
    }
    updateFavButtonState();
    renderFavorites();
    saveToLocalStorage();
}

function updateFavButtonState() {
    const btn = document.getElementById('favBtn');
    const active = playerState.currentVideoId && isFavorite(playerState.currentVideoId);
    btn.classList.toggle('active-fav', !!active);
}

function addToHistory(videoId, title) {
    playerState.history = playerState.history.filter(h => h.videoId !== videoId);
    playerState.history.unshift({ videoId, title, ts: Date.now() });
    if (playerState.history.length > 40) playerState.history.length = 40;
    renderHistory();
    saveToLocalStorage();
}

function clearHistory() {
    playerState.history = [];
    renderHistory();
    saveToLocalStorage();
    showToast('History cleared');
}

function renderCardGrid(containerId, items, emptyIcon, emptyText, showRemove) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state wide"><i data-lucide="${emptyIcon}"></i><p>${emptyText}</p></div>`;
        lucide.createIcons();
        return;
    }
    items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <div class="result-thumb">
                <img src="${thumbUrl(item.videoId, 'mqdefault')}" alt="" loading="lazy">
                <div class="play-overlay"><i data-lucide="play"></i></div>
            </div>
            <div class="result-body">
                <div class="result-title">${escapeHtml(item.title)}</div>
                <div class="result-actions">
                    <button class="play-item"><i data-lucide="play"></i> Play</button>
                    <button class="queue-item"><i data-lucide="plus"></i> Queue</button>
                </div>
            </div>
        `;
        card.querySelector('.play-item').onclick = (e) => { e.stopPropagation(); loadVideo(item.videoId, item.title); switchTab('player'); };
        card.querySelector('.queue-item').onclick = (e) => { e.stopPropagation(); addToPlaylist(item.videoId, item.title); };
        card.onclick = () => { loadVideo(item.videoId, item.title); switchTab('player'); };
        container.appendChild(card);
    });
    lucide.createIcons();
}

function renderFavorites() { renderCardGrid('favoritesGrid', playerState.favorites, 'heart', 'No favorites yet — tap the heart on a playing video'); }
function renderHistory() { renderCardGrid('historyGrid', playerState.history, 'history', 'Videos you play will show up here'); }

// ═══════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ═══════════════════════════════════════════════════════
//  BROWSE / YOUTUBE SEARCH (YouTube Data API v3)
// ═══════════════════════════════════════════════════════
async function searchYouTube() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    if (!playerState.apiKey) {
        showToast('Add a YouTube Data API key in Settings to browse');
        openSettings();
        return;
    }
    const grid = document.getElementById('resultsGrid');
    grid.innerHTML = `<div class="empty-state wide"><i data-lucide="loader-2"></i><p>Searching…</p></div>`;
    lucide.createIcons();

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=16&q=${encodeURIComponent(query)}&key=${encodeURIComponent(playerState.apiKey)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
            const msg = (data && data.error && data.error.message) || 'Search failed';
            grid.innerHTML = `<div class="empty-state wide"><i data-lucide="alert-triangle"></i><p>${escapeHtml(msg)}</p></div>`;
            lucide.createIcons();
            return;
        }
        const items = (data.items || []).filter(it => it.id && it.id.videoId);
        if (items.length === 0) {
            grid.innerHTML = `<div class="empty-state wide"><i data-lucide="search-x"></i><p>No results for "${escapeHtml(query)}"</p></div>`;
            lucide.createIcons();
            return;
        }
        grid.innerHTML = '';
        items.forEach(it => {
            const videoId = it.id.videoId;
            const title = it.snippet.title;
            const channel = it.snippet.channelTitle;
            const thumb = (it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default) || {}).url || thumbUrl(videoId);
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="result-thumb">
                    <img src="${thumb}" alt="" loading="lazy">
                    <div class="play-overlay"><i data-lucide="play"></i></div>
                </div>
                <div class="result-body">
                    <div class="result-title">${escapeHtml(title)}</div>
                    <div class="result-channel">${escapeHtml(channel)}</div>
                    <div class="result-actions">
                        <button class="play-item"><i data-lucide="play"></i> Play</button>
                        <button class="queue-item"><i data-lucide="plus"></i> Queue</button>
                    </div>
                </div>
            `;
            card.querySelector('.play-item').onclick = (e) => { e.stopPropagation(); loadVideo(videoId, title); switchTab('player'); };
            card.querySelector('.queue-item').onclick = (e) => { e.stopPropagation(); addToPlaylist(videoId, title); };
            card.onclick = () => { loadVideo(videoId, title); switchTab('player'); };
            grid.appendChild(card);
        });
        lucide.createIcons();
    } catch (e) {
        grid.innerHTML = `<div class="empty-state wide"><i data-lucide="wifi-off"></i><p>Couldn't reach YouTube. Check your connection or API key.</p></div>`;
        lucide.createIcons();
    }
}

// ═══════════════════════════════════════════════════════
//  SETTINGS MODAL
// ═══════════════════════════════════════════════════════
function openSettings() {
    document.getElementById('apiKeyInput').value = playerState.apiKey || '';
    document.getElementById('settingsModal').classList.add('visible');
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('visible'); }

function saveApiKey() {
    playerState.apiKey = document.getElementById('apiKeyInput').value.trim();
    saveToLocalStorage();
    showToast(playerState.apiKey ? 'API key saved' : 'API key cleared');
    document.getElementById('searchHint').style.display = playerState.apiKey ? 'none' : 'block';
    closeSettings();
}

function setTheme(theme) {
    playerState.theme = theme;
    document.body.classList.toggle('light-theme', theme === 'light');
    document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    saveToLocalStorage();
}

// ═══════════════════════════════════════════════════════
//  DOWNLOAD MODAL (no direct YouTube extraction — see note)
// ═══════════════════════════════════════════════════════
function openDownloadModal() {
    if (!playerState.currentVideoId) { showToast('Nothing playing yet'); return; }
    document.getElementById('downloadModal').classList.add('visible');
}
function closeDownloadModal() { document.getElementById('downloadModal').classList.remove('visible'); }

function openOnYouTube() {
    if (!playerState.currentVideoId) return;
    window.open(`https://www.youtube.com/watch?v=${playerState.currentVideoId}`, '_blank', 'noopener');
}

function exportLibrary() {
    const payload = {
        exportedAt: new Date().toISOString(),
        app: 'ShinPlay',
        queue: playerState.playlist,
        favorites: playerState.favorites,
        history: playerState.history
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shinplay-library.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Library exported');
}

// ═══════════════════════════════════════════════════════
//  TOASTS
// ═══════════════════════════════════════════════════════
function showToast(message) {
    const stack = document.getElementById('toastStack');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ═══════════════════════════════════════════════════════
//  POPOVERS (speed / sleep timer)
// ═══════════════════════════════════════════════════════
function hidePopovers() {
    document.getElementById('sleepPopover').classList.remove('visible');
    document.getElementById('speedPopover').classList.remove('visible');
}

function togglePopover(popoverEl, anchorEl) {
    const wasVisible = popoverEl.classList.contains('visible');
    hidePopovers();
    if (wasVisible) return;
    const rect = anchorEl.getBoundingClientRect();
    popoverEl.style.left = Math.max(12, rect.left) + 'px';
    popoverEl.style.top = (rect.top - 8) + 'px';
    popoverEl.style.transform = 'translateY(-100%)';
    popoverEl.classList.add('visible');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.popover') && !e.target.closest('#sleepBtn') && !e.target.closest('#speedBtn')) {
        hidePopovers();
    }
});

// ═══════════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════════
function saveToLocalStorage() {
    try { localStorage.setItem('shinPlayState', JSON.stringify(playerState)); } catch (e) {}
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('shinPlayState');
        if (saved) {
            const parsed = JSON.parse(saved);
            playerState = { ...playerState, ...parsed };

            if (playerState.currentVideoId) loadVideo(playerState.currentVideoId, playerState.currentVideoTitle);
            if (playerState.isAudioMode) { playerState.isAudioMode = false; toggleAudioMode(); }
            if (playerState.isMiniPlayer) { playerState.isMiniPlayer = false; toggleMiniPlayer(); }
            if (playerState.shuffle) document.getElementById('shuffleBtn').classList.add('active');
            if (playerState.repeat !== 'off') {
                const btn = document.getElementById('repeatBtn');
                btn.classList.add('active');
                btn.innerHTML = playerState.repeat === 'one' ? '<i data-lucide="repeat-1"></i>' : '<i data-lucide="repeat"></i>';
            }
            if (playerState.playbackRate && playerState.playbackRate !== 1) {
                document.getElementById('speedBtn').textContent = playerState.playbackRate + 'x';
            }
            document.getElementById('apiKeyInput').value = playerState.apiKey || '';
            document.getElementById('searchHint').style.display = playerState.apiKey ? 'none' : 'block';
            if (playerState.theme === 'light') setTheme('light');

            renderPlaylist();
            renderFavorites();
            renderHistory();
            lucide.createIcons();
        }
    } catch (e) {}
}

// ═══════════════════════════════════════════════════════
//  MEDIA SESSION API — lock-screen / notification controls
// ═══════════════════════════════════════════════════════
function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
        navigator.mediaSession.setActionHandler('play', () => player && player.playVideo && player.playVideo());
        navigator.mediaSession.setActionHandler('pause', () => player && player.pauseVideo && player.pauseVideo());
        navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (player && player.seekTo && details.seekTime != null) player.seekTo(details.seekTime, true);
        });
        navigator.mediaSession.setActionHandler('stop', () => player && player.pauseVideo && player.pauseVideo());
    } catch (e) {}
}

function updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !playerState.currentVideoId) return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: playerState.currentVideoTitle || 'Playing on ShinPlay',
            artist: playerState.currentVideoChannel || 'ShinPlay',
            album: 'ShinPlay',
            artwork: [
                { src: thumbUrl(playerState.currentVideoId, 'mqdefault'), sizes: '320x180', type: 'image/jpeg' },
                { src: thumbUrl(playerState.currentVideoId, 'hqdefault'), sizes: '480x360', type: 'image/jpeg' }
            ]
        });
    } catch (e) {}
}

function updateMediaSessionState() {
    if (!('mediaSession' in navigator) || !player || !player.getPlayerState) return;
    const state = player.getPlayerState();
    navigator.mediaSession.playbackState = state === YT.PlayerState.PLAYING ? 'playing'
        : state === YT.PlayerState.PAUSED ? 'paused' : 'none';
}

function updateMediaSessionPosition(currentTime, duration) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
        navigator.mediaSession.setPositionState({
            duration: duration || 0,
            playbackRate: playerState.playbackRate || 1,
            position: Math.min(currentTime || 0, duration || 0)
        });
    } catch (e) {}
}

// ═══════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════
function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    if (e.code === 'ArrowRight' && e.shiftKey) { playNext(); }
    if (e.code === 'ArrowLeft' && e.shiftKey) { playPrevious(); }
}

// ═══════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════
document.getElementById('loadVideoBtn').addEventListener('click', () => {
    const input = document.getElementById('videoUrlInput').value;
    const videoId = extractVideoId(input);
    if (videoId) {
        loadVideo(videoId);
        document.getElementById('videoUrlInput').value = '';
    } else {
        showToast('Please enter a valid YouTube URL or Video ID');
    }
});
document.getElementById('videoUrlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('loadVideoBtn').click();
});

document.getElementById('addVideoBtn').addEventListener('click', () => {
    const input = document.getElementById('addVideoInput').value;
    if (input.trim()) addToPlaylist(input);
});
document.getElementById('addVideoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('addVideoBtn').click();
});

document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
document.getElementById('miniPlayBtn').addEventListener('click', togglePlayPause);
document.getElementById('progressBar').addEventListener('input', (e) => seekTo(e.target.value));
document.getElementById('volumeSlider').addEventListener('input', (e) => setVolume(e.target.value));
document.getElementById('muteBtn').addEventListener('click', toggleMute);
document.getElementById('audioModeBtn').addEventListener('click', toggleAudioMode);
document.getElementById('miniPlayerBtn').addEventListener('click', toggleMiniPlayer);
document.getElementById('pipBtn').addEventListener('click', enablePictureInPicture);
document.getElementById('closeMiniBtn').addEventListener('click', closeMiniPlayer);
document.getElementById('miniRestoreBtn').addEventListener('click', closeMiniPlayer);
document.getElementById('miniNextBtn').addEventListener('click', playNext);
document.getElementById('nextBtn').addEventListener('click', playNext);
document.getElementById('prevBtn').addEventListener('click', playPrevious);
document.getElementById('clearPlaylistBtn').addEventListener('click', clearPlaylist);
document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
document.getElementById('repeatBtn').addEventListener('click', cycleRepeat);
document.getElementById('theaterBtn').addEventListener('click', toggleTheater);
document.getElementById('favBtn').addEventListener('click', toggleFavoriteCurrent);
document.getElementById('shareBtn').addEventListener('click', async () => {
    if (!playerState.currentVideoId) { showToast('Nothing playing yet'); return; }
    const url = `https://www.youtube.com/watch?v=${playerState.currentVideoId}`;
    if (navigator.share) {
        try { await navigator.share({ title: playerState.currentVideoTitle || 'ShinPlay', url }); return; } catch (e) {}
    }
    try { await navigator.clipboard.writeText(url); showToast('Link copied'); } catch (e) { showToast(url); }
});
document.getElementById('downloadBtn').addEventListener('click', openDownloadModal);
document.getElementById('closeDownloadBtn').addEventListener('click', closeDownloadModal);
document.getElementById('openOnYoutubeBtn').addEventListener('click', openOnYouTube);
document.getElementById('exportQueueBtn2').addEventListener('click', exportLibrary);

document.getElementById('speedBtn').addEventListener('click', (e) => togglePopover(document.getElementById('speedPopover'), e.currentTarget));
document.getElementById('sleepBtn').addEventListener('click', (e) => togglePopover(document.getElementById('sleepPopover'), e.currentTarget));
document.querySelectorAll('#speedOptions button').forEach(b => b.addEventListener('click', () => setPlaybackRate(Number(b.dataset.rate))));
document.querySelectorAll('#sleepOptions button').forEach(b => b.addEventListener('click', () => setSleepTimer(Number(b.dataset.min))));

document.getElementById('searchBtn').addEventListener('click', searchYouTube);
document.getElementById('searchInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') searchYouTube(); });
document.getElementById('openSettingsFromHint').addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
document.getElementById('settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
document.getElementById('downloadModal').addEventListener('click', (e) => { if (e.target.id === 'downloadModal') closeDownloadModal(); });
document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
document.querySelectorAll('.theme-opt').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));
document.getElementById('exportQueueBtn').addEventListener('click', exportLibrary);
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

document.addEventListener('keydown', handleKeyboardShortcuts);

// ═══════════════════════════════════════════════════════
//  PWA INSTALL — home screen support
// ═══════════════════════════════════════════════════════
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function showInstallUI() {
    if (isStandalone()) return;
    if (localStorage.getItem('shinPlayInstallDismissed') === '1') return;
    document.getElementById('installBtn').classList.remove('hidden');
    document.getElementById('installBanner').classList.add('visible');
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallUI();
});

async function triggerInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        document.getElementById('installBtn').classList.add('hidden');
        document.getElementById('installBanner').classList.remove('visible');
        if (outcome === 'accepted') showToast('ShinPlay installed');
    } else if (isIOS()) {
        showToast('On iPhone/iPad: tap Share, then "Add to Home Screen"');
    } else {
        showToast('Use your browser menu → "Install app" / "Add to Home Screen"');
    }
}

document.getElementById('installBtn').addEventListener('click', triggerInstall);
document.getElementById('installBannerBtn').addEventListener('click', triggerInstall);
document.getElementById('installFromSettingsBtn').addEventListener('click', triggerInstall);
document.getElementById('installBannerClose').addEventListener('click', () => {
    document.getElementById('installBanner').classList.remove('visible');
    localStorage.setItem('shinPlayInstallDismissed', '1');
});

window.addEventListener('appinstalled', () => {
    document.getElementById('installBtn').classList.add('hidden');
    document.getElementById('installBanner').classList.remove('visible');
});

// iOS never fires beforeinstallprompt — surface the manual instructions banner instead.
if (isIOS() && !isStandalone() && localStorage.getItem('shinPlayInstallDismissed') !== '1') {
    setTimeout(showInstallUI, 1500);
}

// ═══════════════════════════════════════════════════════
//  BACKGROUND / SLEEP PREVENTION
// ═══════════════════════════════════════════════════════

// ── 1. Wake Lock API (Android Chrome, Edge, desktop) ──
let wakeLock = null;

async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {}
}

async function releaseWakeLock() {
    if (wakeLock) {
        try { await wakeLock.release(); } catch (e) {}
        wakeLock = null;
    }
}

// Re-acquire wake lock when tab becomes visible again
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await requestWakeLock();
        if (playerState.wasPlayingBeforeSleep && player && player.playVideo) {
            try { player.playVideo(); } catch (e) {}
            playerState.wasPlayingBeforeSleep = false;
        }
        const vids = document.querySelectorAll('.video-bg video');
        vids.forEach(v => { try { v.play(); } catch (e) {} });
    } else {
        try {
            if (player && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING) {
                playerState.wasPlayingBeforeSleep = true;
            }
        } catch (e) {}
        const vids = document.querySelectorAll('.video-bg video');
        vids.forEach(v => { try { v.pause(); } catch (e) {} });
    }
});

// ── 2. Silent audio loop (iOS Safari workaround) ──
// iOS suspends pages with no active audio session; a silent looping buffer
// keeps the session alive so audio can keep going when the app is backgrounded.
function initSilentAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    let ctx, source, gainNode;

    function createSilentLoop() {
        if (ctx) return;
        ctx = new AudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        gainNode = ctx.createGain();
        gainNode.gain.value = 0.001;
        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
    }

    const triggers = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    function onFirstInteraction() {
        createSilentLoop();
        triggers.forEach(t => document.removeEventListener(t, onFirstInteraction));
    }
    triggers.forEach(t => document.addEventListener(t, onFirstInteraction, { once: false }));
}

initSilentAudio();
