let player;
let show_yt_video = false;
let currentYouTubeVideo = null;
let youtubePlayStartTimestamp = null;
let youtubeLoggedStart = false;

const apiKey = (window.SECRETS && window.SECRETS.YOUTUBE_API_KEY) || "";

function stopYouTubePlayback() {
  // Log partial progress if a YouTube session was started but not ended yet
  const playerState = player && typeof player.getPlayerState === 'function' ? player.getPlayerState() : null;
  const reachedEnd = typeof YT !== 'undefined' && YT.PlayerState ? playerState === YT.PlayerState.ENDED : false;

  if (currentYouTubeVideo && youtubeLoggedStart && !reachedEnd) {
    logYouTubePlayback(false);
  }

  const youtubePlayerEl = document.getElementById('youtubePlayer');
  if (youtubePlayerEl) {
    youtubePlayerEl.classList.remove('fullscreen');
    youtubePlayerEl.classList.add('hidden');
  }

  if (player && typeof player.stopVideo === 'function') {
    player.stopVideo();
  }

  resetYouTubeSession();
  show_yt_video = false;
}

// Expose to other modules (e.g., main.js) so normal video playback can hide the iframe
window.stopYouTubePlayback = stopYouTubePlayback;

function resetYouTubeSession() {
  currentYouTubeVideo = null;
  youtubePlayStartTimestamp = null;
  youtubeLoggedStart = false;
}

function logYouTubePlayback(completed) {
  if (!currentYouTubeVideo || typeof logPlay !== 'function') return;

  const duration = player && typeof player.getDuration === 'function' ? player.getDuration() : 0;
  const currentTime = player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
  const totalDuration = Number.isFinite(duration) ? duration : 0;
  const playedSeconds = Number.isFinite(currentTime) ? currentTime : 0;
  const timestamp = youtubePlayStartTimestamp || Date.now();

  logPlay(
    currentYouTubeVideo.title || 'YouTube Video',
    timestamp,
    completed ? (totalDuration || playedSeconds) : playedSeconds,
    totalDuration,
    completed,
    {
      source: 'youtube',
      youtubeId: currentYouTubeVideo.id,
      youtubeUrl: currentYouTubeVideo.url
    }
  );
}

function onYouTubeIframeAPIReady() {
  player = new YT.Player('youtubePlayer', {
    height: '360',
    width: '640',
    videoId: '', // Initial video
    playerVars: {
      controls: 0,
      disablekb: 0,
      enablejsapi: 1,
      playsinline: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
  initYouTube();
}

function initYouTube() {
  const youtubeBtn = document.getElementById('youtubeBtn');
  youtubeBtn.addEventListener('click', searchYouTube);
}

function onPlayerReady(event) {
  console.log('YouTube Player ready');
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    logYouTubePlayback(true);
    resetYouTubeSession();
    return;
  }

  if (event.data === YT.PlayerState.PLAYING) {
    if (!youtubePlayStartTimestamp) {
      youtubePlayStartTimestamp = Date.now();
    }

    // Only record the initial start once per session
    if (!youtubeLoggedStart) {
      logYouTubePlayback(false);
      youtubeLoggedStart = true;
    }
  }
}

function loadVideo(videoId, title = '') {
  // Load the selected video
  console.log('Loading video ID:', videoId);

  currentYouTubeVideo = {
    id: videoId,
    title: title || 'YouTube Video',
    url: `https://youtu.be/${videoId}`
  };
  youtubePlayStartTimestamp = null;
  youtubeLoggedStart = false;

  player.loadVideoById(videoId);

  const youtubePlayerEl = document.getElementById('youtubePlayer');
  youtubePlayerEl.classList.remove('hidden');
  youtubePlayerEl.classList.add('fullscreen');
  
  const playerContainer = document.getElementById('playerContainer');
  playerContainer.style.display = 'flex';
}

function searchYouTube() {
  if (!apiKey) {
    alert('YouTube API key is missing. Add it to secret-config.js (not committed to git).');
    return;
  }

  const query = document.getElementById('search').value.trim();

  if (!query) {
    alert('Please enter a search term.');
    return;
  }

  fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent('karaoke ' + query)}&type=video&maxResults=10&key=${apiKey}`)
    .then((response) => response.json())
    .then(async (data) => {
      const ids = data.items.map((item) => item.id.videoId).join(',');

      // Check embeddability of videos
      const statusRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${ids}&key=${apiKey}`
      );
      const statusData = await statusRes.json();

      const embeddableMap = {};
      statusData.items.forEach((video) => {
        embeddableMap[video.id] = video.status.embeddable;
      });

      const container = document.getElementById('videoList');
      container.innerHTML = ''; // Clear the current video list

      data.items.forEach((item) => {
        const videoId = item.id.videoId;

        // Skip non-embeddable videos
        if (!embeddableMap[videoId]) return;

        const thumb = item.snippet.thumbnails.medium.url;
        const title = item.snippet.title;

        const div = document.createElement('div');
        div.className = 'card'; // Use the same class for consistent styling
        div.innerHTML = `
          <img src="${thumb}" alt="${title}">
          <div class="title">${title}</div>
        `;
        div.onclick = () => {
          show_yt_video = true;
          loadVideo(videoId, title);
        };
        container.appendChild(div);
      });
    })
    .catch((error) => {
      console.error('Error fetching YouTube data:', error);
    });
}
