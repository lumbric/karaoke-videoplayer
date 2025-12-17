let allVideos = [];
let playedLog = JSON.parse(localStorage.getItem("playedLog") || "[]");
let chartInstance = null;
let isFormOpen = false; // Flag to track if song request form is open

// Configuration for video display and search
const CONFIG = {
  BATCH_SIZE: 40,              // Number of videos to load per batch
  MAX_DISPLAY_COUNT: 160       // Maximum number of videos to display (both start page and search results)
};

let currentVideos = [];
let currentMode = "random"; // or "search"
let currentSearchQuery = "";
let currentOffset = 0;


async function loadVideos() {
  try {
    const res = await fetch("videos.json");
    const rawVideos = await res.json();
    // Transform to include computed file paths and display title
    allVideos = rawVideos.map(video => {
      let displayTitle, artist, title, searchText;
      if (video.artist && video.title) {
        artist = video.artist;
        title = video.title;
        displayTitle = `${artist} - ${title}`;
        searchText = `${artist} ${title}`.toLowerCase();
      } else if (video.artist || video.title) {
        artist = video.artist || "";
        title = video.title || "";
        displayTitle = video.artist ? `${video.artist} - ${video.title || ""}` : video.title;
        searchText = `${artist} ${title}`.toLowerCase();
      } else if (video.title) {
        displayTitle = video.title;
        if (video.title.includes(' - ')) {
          const parts = video.title.split(' - ');
          artist = parts[0];
          title = parts.slice(1).join(' - ');
          searchText = `${artist} ${title}`.toLowerCase();
        } else {
          artist = "";
          title = video.title;
          searchText = video.title.toLowerCase();
        }
      } else {
        const filename = video.filename || video.file?.split('/').pop()?.replace(/\.[^/.]+$/, "") || "Unknown Song";
        displayTitle = filename;
        artist = "";
        title = filename;
        searchText = filename.toLowerCase();
      }
      return {
        ...video,
        file: video.video_filename || `videos/${video.filename}.mp4`,
        cover: video.cover_filename || `covers/${video.filename}.jpg`,
        displayTitle: displayTitle,
        artist: artist,
        title: title,
        searchText: searchText,
        genre: video.genre || "Unbekannt"
      };
    });
    // Populate genre filter (support array of genres)
    const genreSet = new Set();
    allVideos.forEach(v => {
      if (Array.isArray(v.genre)) {
        v.genre.forEach(g => genreSet.add(g));
      } else if (v.genre) {
        genreSet.add(v.genre);
      }
    });
    const genreMenu = document.getElementById("genreMenu");
    // Remove old genre options except 'Alle Genres'
    genreMenu.querySelectorAll('[data-genre]:not([data-genre=""])').forEach(e => e.remove());
    genreSet.forEach(genre => {
      const div = document.createElement("div");
      div.style.padding = "10px 18px";
      div.style.cursor = "pointer";
      div.style.borderBottom = "1px solid #eee";
      div.textContent = genre;
      div.setAttribute("data-genre", genre);
      genreMenu.appendChild(div);
    });
    showRandomVideos();
  } catch (error) {
    console.error("Error loading videos:", error);
  }
}

function showRandomVideos(reset = true) {
  currentMode = "random";
  if (reset) {
    currentOffset = 0;
    currentVideos = shuffle([...allVideos]);
    renderCards(currentVideos.slice(0, CONFIG.BATCH_SIZE));
  } else {
    // Append new batch
    const container = document.getElementById("videoList");
    const alreadyLoaded = container.children.length;
    const nextBatch = currentVideos.slice(alreadyLoaded, alreadyLoaded + CONFIG.BATCH_SIZE);
    nextBatch.forEach(v => {
      cover = v.has_cover ? v.cover : THEME_CONFIG.COVER_FALLBACK_PATH;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<img src="${cover}" onerror="this.src='${THEME_CONFIG.COVER_FALLBACK_PATH}'"><div class="title">${v.displayTitle}</div>`;
      div.onclick = () => playVideo(v);
      container.appendChild(div);
    });
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderCards(videos) {
  const container = document.getElementById("videoList");
  container.innerHTML = "";

  if (videos.length === 0) {
    const searchQuery = document.getElementById('search').value.trim();
    container.innerHTML = `
      <div class="no-results">
        <div class="no-results-message">Keine Videos gefunden</div>
        ${searchQuery ? `
          <button class="btn btn-primary btn-large" onclick="requestSong('${searchQuery.replace(/'/g, "\\'")}')">
            "${searchQuery}" <br>
            für die Song-Kollektion vorschlagen
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  videos.forEach(v => {
    cover = v.has_cover ? v.cover : THEME_CONFIG.COVER_FALLBACK_PATH;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<img src="${cover}" onerror="this.src='${THEME_CONFIG.COVER_FALLBACK_PATH}'"><div class="title">${v.displayTitle}</div>`;
    div.onclick = () => playVideo(v);
    container.appendChild(div);
  });
}


let selectedGenre = "";
let selectedGenrePill;


function handleSearch(query, reset = true) {
  if ((!query || query.length === 0) && !selectedGenre) {
    showRandomVideos(true);
    return;
  }
  currentMode = "search";
  currentSearchQuery = query;
  if (reset) currentOffset = 0;
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  currentVideos = allVideos.filter(v => {
    // Genre filter (support array of genres)
    if (selectedGenre) {
      if (Array.isArray(v.genre)) {
        if (!v.genre.includes(selectedGenre)) return false;
      } else if (v.genre !== selectedGenre) {
        return false;
      }
    }
    const searchFields = [
      v.filename || "",
      v.artist || "",
      v.title || "",
      v.searchText || ""
    ];
    return searchTerms.every(term =>
      searchFields.some(field =>
        field.toLowerCase().includes(term)
      )
    );
  });
  if (currentVideos.length === 0) {
    renderCards([]);
    return;
  }
  if (reset) {
    renderCards(currentVideos.slice(0, CONFIG.BATCH_SIZE));
  } else {
    // Append new batch
    const container = document.getElementById("videoList");
    const alreadyLoaded = container.children.length;
    const nextBatch = currentVideos.slice(alreadyLoaded, alreadyLoaded + CONFIG.BATCH_SIZE);
    nextBatch.forEach(v => {
      cover = v.has_cover ? v.cover : THEME_CONFIG.COVER_FALLBACK_PATH;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<img src="${cover}" onerror="this.src='${THEME_CONFIG.COVER_FALLBACK_PATH}'"><div class="title">${v.displayTitle}</div>`;
      div.onclick = () => playVideo(v);
      container.appendChild(div);
    });
  }
}

// Global session tracking variables
let currentSessionStartTime = null;
let currentVideoTitle = null;
let isNewPlaySession = true;

function playVideo(video) {
  const player = document.getElementById("videoPlayer");
  const container = document.getElementById("playerContainer");
  const btn = document.getElementById("closeBtn");

  // Hide any active YouTube iframe before switching to local playback
  if (window.stopYouTubePlayback) {
    window.stopYouTubePlayback();
  }

  player.src = video.file;
  container.style.display = "flex";
  btn.style.display = "block";

  // Hide cursor and button initially
  container.classList.remove("show-cursor");
  btn.classList.remove("visible");

  // Initialize session tracking
  currentSessionStartTime = Date.now();
  currentVideoTitle = video.displayTitle;
  isNewPlaySession = true;

  let playStartTime = 0;
  let totalDuration = 0;
  let ended = false;

  // Get video duration when metadata loads
  player.onloadedmetadata = () => {
    totalDuration = player.duration;
    playStartTime = player.currentTime;
    // Update button text when video starts playing (autoplay)
    const playPauseBtn = document.getElementById("playPauseBtn");
    playPauseBtn.textContent = "⏸ Pause";
  };

  player.onended = () => {
    ended = true;
    // Only log completion if this was a real play session
    if (isNewPlaySession) {
      logPlay(currentVideoTitle, currentSessionStartTime, totalDuration, totalDuration, true);
    }
    // Update button text when video ends
    const playPauseBtn = document.getElementById("playPauseBtn");
    playPauseBtn.textContent = "▶ Play";
    closePlayer();
  };

  player.onpause = () => {
    // Don't log on pause - we only want to log actual plays, not pauses
    // Update button text when video is paused
    const playPauseBtn = document.getElementById("playPauseBtn");
    playPauseBtn.textContent = "▶ Play";
  };

  player.onplay = () => {
    // Update button text when video starts playing
    const playPauseBtn = document.getElementById("playPauseBtn");
    playPauseBtn.textContent = "⏸ Pause";
    
    // If resuming from pause, don't count as new play
    if (player.currentTime > 1) { // If we're more than 1 second in, it's a resume
      isNewPlaySession = false;
    }
  };

  // Log initial play (only when video actually starts from beginning)
  logPlay(currentVideoTitle, currentSessionStartTime, 0, 0, false);
}

function closePlayer() {
  const player = document.getElementById("videoPlayer");
  const container = document.getElementById("playerContainer");
  const btn = document.getElementById("closeBtn");

  // Ensure YouTube playback is stopped/hidden when closing the player
  if (window.stopYouTubePlayback) {
    window.stopYouTubePlayback();
  }

  player.pause();
  player.src = "";
  container.style.display = "none";

  // Reset cursor and button state
  container.classList.remove("show-cursor");
  btn.classList.remove("visible");
}

function logPlay(title, timestamp, playedSeconds, totalDuration, completed) {
  playedLog.push({
    title,
    timestamp,
    playedSeconds: Math.round(playedSeconds),
    totalDuration: Math.round(totalDuration),
    completed,
    playPercentage: totalDuration > 0 ? Math.round((playedSeconds / totalDuration) * 100) : 0
  });
  localStosearchElrage.setItem("playedLog", JSON.stringify(playedLog));
}


function resetGenreFilter() {
  selectedGenre = "";
  selectedGenrePill.style.display = "none";
  genreMenu.querySelectorAll('[data-genre]').forEach(el => {
    el.style.background = el.getAttribute("data-genre") === "" ? "#cd6391" : "#fff";
    el.style.color = el.getAttribute("data-genre") === "" ? "#fff" : "#4E4E4E";
  });
  handleSearch(document.getElementById("search").value.trim(), true);
}

// Custom video control functions
function togglePlayPause() {
  const player = document.getElementById("videoPlayer");
  const playPauseBtn = document.getElementById("playPauseBtn");
  if (player.paused) {
    player.play();
    playPauseBtn.textContent = "⏸ Pause";
  } else {
    player.pause();
    playPauseBtn.textContent = "▶ Play";
  }
}

function toggleMute() {
  const player = document.getElementById("videoPlayer");
  player.muted = !player.muted;
}

function adjustVolume(change) {
  const player = document.getElementById("videoPlayer");
  const newVolume = Math.max(0, Math.min(1, player.volume + change));
  player.volume = newVolume;
}

function restartVideo() {
  const player = document.getElementById("videoPlayer");
  const playPauseBtn = document.getElementById("playPauseBtn");

  // Reset to beginning and mark as new play session
  player.currentTime = 0;
  player.play();
  playPauseBtn.textContent = "⏸ Pause";

  // This counts as a new play session
  currentSessionStartTime = Date.now();
  isNewPlaySession = true;

  // Log the restart as a new play
  if (currentVideoTitle) {
    logPlay(currentVideoTitle, currentSessionStartTime, 0, 0, false);
  }
}

function exportStats() {
  const logs = JSON.parse(localStorage.getItem("playedLog") || "[]");
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "karaoke_stats.json";
  a.click();
  URL.revokeObjectURL(url);
}

function renderChart() {
  const logs = JSON.parse(localStorage.getItem("playedLog") || "[]");

  if (logs.length === 0) {
    document.getElementById('totalSongs').textContent = '0';
    document.getElementById('totalPlayTime').textContent = '0min';
    document.getElementById('mostPlayed').textContent = '-';
    document.getElementById('completionRate').textContent = '0%';
    return;
  }

  // Calculate statistics
  const stats = calculateStatistics(logs);

  // Update summary cards
  updateSummaryCards(stats);

  // Render charts
  renderMostPlayedChart(stats.mostPlayedSongs);
  renderPlayTimeChart(stats.playTimeDistribution);
  renderHourlyChart(stats.hourlyActivity);
  renderSkippedList(stats.skippedSongs);
  renderInstantSkipsList(stats.instantSkips);
  renderHiddenGemsList(stats.hiddenGems);
  renderRetryList(stats.retrySongs);
  renderCompletionChart(stats.completionDistribution);
  renderRecentActivity(logs.slice(-10).reverse());
}

function calculateStatistics(logs) {
  const songStats = {};
  const dailyActivity = {};
  const hourlyActivity = {
    completed: Array(50).fill(0),
    aborted: Array(50).fill(0),
    labels: []
  };
  let totalPlayTime = 0;
  let completedSongs = 0;

  logs.forEach(log => {
    if (!songStats[log.title]) {
      songStats[log.title] = {
        playCount: 0,
        totalPlayTime: 0,
        totalDuration: 0,
        completions: 0,
        avgCompletion: 0,
        instantSkips: 0, // <30 seconds
        restarts: 0 // Multiple plays in short time
      };
    }

    const song = songStats[log.title];
    song.playCount++;
    song.totalPlayTime += log.playedSeconds || 0;
    if (log.totalDuration > 0) song.totalDuration = log.totalDuration;
    if (log.completed) song.completions++;

    // Count instant skips (<30 seconds)
    if (log.playedSeconds < 30) song.instantSkips++;

    totalPlayTime += log.playedSeconds || 0;
    if (log.completed) completedSongs++;

    // Daily activity
    const date = new Date(log.timestamp).toDateString();
    dailyActivity[date] = (dailyActivity[date] || 0) + 1;

  });

  // Generate labels for last 50 hours
  const now = new Date();
  for (let i = 49; i >= 0; i--) {
    const hourTime = new Date(now.getTime() - i * 60 * 60 * 1000);
    const label = `${hourTime.getDate().toString().padStart(2, '0')}.${(hourTime.getMonth() + 1).toString().padStart(2, '0')} ${hourTime.getHours().toString().padStart(2, '0')}:00`;
    hourlyActivity.labels.push(label);
  }

  // Count activities in last 50 hours
  logs.forEach(log => {
    const logTime = new Date(log.timestamp);
    const hoursAgo = Math.floor((now - logTime) / (1000 * 60 * 60));

    if (hoursAgo >= 0 && hoursAgo < 50) {
      const index = 49 - hoursAgo; // Reverse index (0 = 49 hours ago, 49 = current hour)
      if (log.completed) {
        hourlyActivity.completed[index]++;
      } else {
        hourlyActivity.aborted[index]++;
      }
    }
  });

  // Calculate average completion rates and detect restarts
  Object.keys(songStats).forEach(title => {
    const song = songStats[title];
    song.avgCompletion = song.playCount > 0 ? (song.completions / song.playCount) * 100 : 0;

    // Simple restart detection: high play count vs completion rate
    if (song.playCount > 3 && song.avgCompletion < 50) {
      song.restarts = song.playCount - song.completions;
    }
  });

  // Get most played songs (top 15)
  const mostPlayedSongs = Object.entries(songStats)
    .sort(([,a], [,b]) => b.playCount - a.playCount)
    .slice(0, 15);

  // Get most skipped songs (played multiple times but low completion rate)
  const skippedSongs = Object.entries(songStats)
    .filter(([,song]) => song.playCount >= 2 && song.avgCompletion < 40)
    .sort(([,a], [,b]) => a.avgCompletion - b.avgCompletion)
    .slice(0, 10);

  // Get instant skip songs (most songs stopped within 30 seconds)
  const instantSkips = Object.entries(songStats)
    .filter(([,song]) => song.instantSkips >= 2)
    .sort(([,a], [,b]) => b.instantSkips - a.instantSkips)
    .slice(0, 10);

  // Get hidden gems (rarely played but high completion when they are)
  const hiddenGems = Object.entries(songStats)
    .filter(([,song]) => song.playCount <= 3 && song.avgCompletion > 70 && song.playCount > 0)
    .sort(([,a], [,b]) => b.avgCompletion - a.avgCompletion)
    .slice(0, 10);

  // Get retry songs (often restarted)
  const retrySongs = Object.entries(songStats)
    .filter(([,song]) => song.restarts > 0)
    .sort(([,a], [,b]) => b.restarts - a.restarts)
    .slice(0, 10);

  // Play time distribution
  const playTimeRanges = {
    '0-25%': 0,
    '26-50%': 0,
    '51-75%': 0,
    '76-100%': 0
  };

  logs.forEach(log => {
    if (log.playPercentage <= 25) playTimeRanges['0-25%']++;
    else if (log.playPercentage <= 50) playTimeRanges['26-50%']++;
    else if (log.playPercentage <= 75) playTimeRanges['51-75%']++;
    else playTimeRanges['76-100%']++;
  });

  // Completion rate distribution for all songs
  const completionDistribution = {
    'Very Low (0-20%)': 0,
    'Low (21-40%)': 0,
    'Medium (41-60%)': 0,
    'High (61-80%)': 0,
    'Very High (81-100%)': 0
  };

  Object.values(songStats).forEach(song => {
    if (song.avgCompletion <= 20) completionDistribution['Very Low (0-20%)']++;
    else if (song.avgCompletion <= 40) completionDistribution['Low (21-40%)']++;
    else if (song.avgCompletion <= 60) completionDistribution['Medium (41-60%)']++;
    else if (song.avgCompletion <= 80) completionDistribution['High (61-80%)']++;
    else completionDistribution['Very High (81-100%)']++;
  });

  return {
    totalSongs: Object.keys(songStats).length,
    totalPlayTime: Math.round(totalPlayTime / 60),
    mostPlayedSong: mostPlayedSongs[0] ? mostPlayedSongs[0][0] : '-',
    completionRate: Math.round((completedSongs / logs.length) * 100),
    mostPlayedSongs,
    skippedSongs,
    instantSkips,
    hiddenGems,
    retrySongs,
    playTimeDistribution: playTimeRanges,
    completionDistribution,
    dailyActivity,
    hourlyActivity
  };
}

function updateSummaryCards(stats) {
  document.getElementById('totalSongs').textContent = stats.totalSongs;
  document.getElementById('totalPlayTime').textContent = `${stats.totalPlayTime}min`;
  document.getElementById('mostPlayed').textContent = stats.mostPlayedSong;
  document.getElementById('completionRate').textContent = `${stats.completionRate}%`;
}

function renderMostPlayedChart(mostPlayedSongs) {
  const ctx = document.getElementById('mostPlayedChart').getContext('2d');
  
  if (window.mostPlayedChartInstance) window.mostPlayedChartInstance.destroy();
  
  if (mostPlayedSongs.length === 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  window.mostPlayedChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: mostPlayedSongs.map(([title]) => title.length > 25 ? title.substring(0, 25) + '...' : title),
      datasets: [{
        label: 'Play Count',
        data: mostPlayedSongs.map(([, song]) => song.playCount),
        backgroundColor: 'rgba(205, 99, 145, 0.8)',
        borderColor: '#cd6391',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { 
          ticks: { 
            color: '#fff', 
            maxRotation: 45,
            font: { size: 10 }
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: { 
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          title: {
            display: true,
            text: 'Play Count',
            color: '#fff'
          }
        }
      }
    }
  });
}

function renderPlayTimeChart(playTimeDistribution) {
  const ctx = document.getElementById('playTimeChart').getContext('2d');
  
  if (window.playTimeChartInstance) window.playTimeChartInstance.destroy();

  window.playTimeChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(playTimeDistribution),
      datasets: [{
        data: Object.values(playTimeDistribution),
        backgroundColor: [
          'rgba(244, 67, 54, 0.8)',
          'rgba(255, 152, 0, 0.8)',
          'rgba(255, 235, 59, 0.8)',
          'rgba(76, 175, 80, 0.8)'
        ],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { color: '#fff' }
        }
      }
    }
  });
}

function renderHourlyChart(hourlyActivity) {
  const ctx = document.getElementById('hourlyChart').getContext('2d');
  
  if (window.hourlyChartInstance) window.hourlyChartInstance.destroy();

  window.hourlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hourlyActivity.labels,
      datasets: [
        {
          label: 'Completed Songs',
          data: hourlyActivity.completed,
          backgroundColor: 'rgba(75, 192, 75, 0.8)',
          borderColor: '#4bc04b',
          borderWidth: 1
        },
        {
          label: 'Aborted Songs',
          data: hourlyActivity.aborted,
          backgroundColor: 'rgba(255, 99, 99, 0.8)',
          borderColor: '#ff6363',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { 
          display: true,
          labels: { color: '#fff' }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: function(tooltipItems) {
              return tooltipItems[0].label;
            }
          }
        }
      },
      scales: {
        x: { 
          stacked: true,
          ticks: { 
            color: '#fff',
            maxRotation: 45,
            callback: function(value, index) {
              // Show every 6th label to avoid crowding (50 hours / 8 ≈ 6)
              return index % 6 === 0 ? this.getLabelForValue(value) : '';
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: { 
          stacked: true,
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          title: {
            display: true,
            text: 'Number of Songs',
            color: '#fff'
          }
        }
      }
    }
  });
}

function renderSkippedList(skippedSongs) {
  const container = document.getElementById('skippedList');
  
  if (skippedSongs.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #ccc; padding: 2em;">No skipped songs yet.<br>Songs appear here when played multiple times but rarely completed.</div>';
    return;
  }

  container.innerHTML = skippedSongs.map(([title, song]) => `
    <div class="favorite-item">
      <div class="song-title">${title}</div>
      <div class="completion" style="color: #ff6b6b;">${Math.round(song.avgCompletion)}% completion • ${song.playCount} attempts</div>
    </div>
  `).join('');
}

function renderInstantSkipsList(instantSkips) {
  const container = document.getElementById('instantSkipsList');
  
  if (instantSkips.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #ccc; padding: 2em;">No instant skips detected.<br>Songs appear here when stopped within 30 seconds multiple times.</div>';
    return;
  }

  container.innerHTML = instantSkips.map(([title, song]) => `
    <div class="favorite-item">
      <div class="song-title">${title}</div>
      <div class="completion" style="color: #ff9800;">${song.instantSkips} instant skips • ${song.playCount} total plays</div>
    </div>
  `).join('');
}

function renderHiddenGemsList(hiddenGems) {
  const container = document.getElementById('hiddenGemsList');
  
  if (hiddenGems.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #ccc; padding: 2em;">No hidden gems found.<br>Songs appear here when rarely played but highly completed.</div>';
    return;
  }

  container.innerHTML = hiddenGems.map(([title, song]) => `
    <div class="favorite-item">
      <div class="song-title">${title}</div>
      <div class="completion" style="color: #4caf50;">${Math.round(song.avgCompletion)}% completion • Only ${song.playCount} plays</div>
    </div>
  `).join('');
}

function renderRetryList(retrySongs) {
  const container = document.getElementById('retryList');
  
  if (retrySongs.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #ccc; padding: 2em;">No retry patterns detected.<br>Songs appear here when frequently restarted.</div>';
    return;
  }

  container.innerHTML = retrySongs.map(([title, song]) => `
    <div class="favorite-item">
      <div class="song-title">${title}</div>
      <div class="completion" style="color: #ff9800;">${song.restarts} restarts • ${song.playCount} total plays</div>
    </div>
  `).join('');
}

function renderCompletionChart(completionDistribution) {
  const ctx = document.getElementById('completionChart').getContext('2d');
  
  if (window.completionChartInstance) window.completionChartInstance.destroy();

  window.completionChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(completionDistribution),
      datasets: [{
        data: Object.values(completionDistribution),
        backgroundColor: [
          'rgba(244, 67, 54, 0.8)',
          'rgba(255, 152, 0, 0.8)',
          'rgba(255, 235, 59, 0.8)',
          'rgba(139, 195, 74, 0.8)',
          'rgba(76, 175, 80, 0.8)'
        ],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { 
            color: '#fff',
            font: { size: 10 }
          }
        }
      }
    }
  });
}

function renderRecentActivity(recentLogs) {
  const container = document.getElementById('recentActivity');
  
  if (recentLogs.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #ccc; padding: 1em;">No recent activity</div>';
    return;
  }

  container.innerHTML = recentLogs.map(log => `
    <div class="activity-item">
      <div class="song-title">${log.title}</div>
      <div class="time">${new Date(log.timestamp).toLocaleString('de-DE')} • ${log.playPercentage}%</div>
    </div>
  `).join('');
}

// Song request functionality
function requestSong(searchQuery) {
  // Show request form popup
  showRequestForm(searchQuery);
}

function showRequestForm(searchQuery) {
  // Set flag to disable search-as-you-type
  isFormOpen = true;
  
  // Create form overlay
  const overlay = document.createElement('div');
  overlay.className = 'request-message-overlay';
  overlay.innerHTML = `
    <div class="request-form-popup">
      <div class="request-form-header">
        <h3>🎵 Song vorschlagen</h3>
        <p>Bitte gib die Details des gewünschten Songs an:</p>
      </div>
      <form id="songRequestForm" onsubmit="submitSongRequest(event)">
        <div class="form-group">
          <label for="songTitle">Songtitel:</label>
          <input type="text" id="songTitle" name="songTitle" value="${searchQuery}" required 
                  placeholder="z.B. Bohemian Rhapsody" class="form-input">
        </div>
        <div class="form-group">
          <label for="artistName">Künstler/Band:</label>
          <input type="text" id="artistName" name="artistName" required 
                  placeholder="z.B. Queen" class="form-input">
        </div>
        <div class="form-group">
          <label for="additionalInfo">Zusätzliche Informationen (optional):</label>
          <textarea id="additionalInfo" name="additionalInfo" 
                    placeholder="z.B. spezielle Version, Jahr, etc." class="form-textarea"></textarea>
        </div>
        <div class="form-buttons">
          <button type="button" class="btn btn-secondary" onclick="closeRequestForm()">Abbrechen</button>
          <button type="submit" class="btn btn-primary">Vorschlagen</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Focus on artist field if song title is pre-filled
  setTimeout(() => {
    if (searchQuery && searchQuery.trim()) {
      document.getElementById('artistName').focus();
    } else {
      document.getElementById('songTitle').focus();
    }
  }, 100);
}

function submitSongRequest(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const songTitle = formData.get('songTitle').trim();
  const artistName = formData.get('artistName').trim();
  const additionalInfo = formData.get('additionalInfo').trim();
  
  // Get existing requests from localStorage
  let songRequests = JSON.parse(localStorage.getItem('songRequests') || '[]');
  
  // Create detailed request object
  const newRequest = {
    title: songTitle,
    artist: artistName,
    additionalInfo: additionalInfo,
    timestamp: Date.now(),
    date: new Date().toLocaleString('de-DE')
  };
  
  // Check if song was already requested (by title and artist)
  const alreadyRequested = songRequests.some(req => 
    req.title?.toLowerCase() === songTitle.toLowerCase() && 
    req.artist?.toLowerCase() === artistName.toLowerCase()
  );
  
  if (!alreadyRequested) {
    songRequests.push(newRequest);
    localStorage.setItem('songRequests', JSON.stringify(songRequests));
  }
  
  // Close form and show success message
  closeRequestForm();
  showRequestMessage(songTitle, artistName, alreadyRequested);
}

function closeRequestForm() {
  // Re-enable search-as-you-type
  isFormOpen = false;
  
  const overlay = document.querySelector('.request-message-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function showRequestMessage(songTitle, artistName, alreadyRequested) {
  // Create message overlay
  const overlay = document.createElement('div');
  overlay.className = 'request-message-overlay';
  overlay.innerHTML = `
    <div class="request-success-popup">
      <div class="success-header">
        <div class="success-icon">${alreadyRequested ? '✨' : '🎉'}</div>
        <h3 class="success-title">
          ${alreadyRequested ? 'Bereits vorgeschlagen!' : 'Danke für deinen Vorschlag!'}
        </h3>
      </div>
      <div class="success-content">
        <div class="song-info">
          <div class="song-title">"${songTitle}"</div>
          <div class="song-artist">von ${artistName}</div>
        </div>
        <div class="success-message">
          ${alreadyRequested ? 
            'Dieser Song wurde bereits vorgeschlagen und steht auf unserer Liste.' : 
            'Wir werden versuchen den Song bis zum nächsten Mal hinzuzufügen.'
          }
        </div>
      </div>
      <div class="success-actions">
        <button class="btn btn-primary" onclick="closeRequestMessage()">Weiter</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Auto-close after 15 seconds
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      closeRequestMessage();
    }
  }, 15000);
}

function closeRequestMessage() {
  const overlay = document.querySelector('.request-message-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Initialize theme based on configuration
function initializeTheme() {
  // Set the CSS file
  document.getElementById('themeStylesheet').href = THEME_CONFIG.CSS_PATH;
  
  // Set the page title and main title
  document.title = THEME_CONFIG.TITLE + ' 🎤';
  const titleEl = document.getElementById('title');
  titleEl.textContent = THEME_CONFIG.TITLE;
  const titleWithBraces = titleEl.textContent.replace(/(xmas)/i, '<span class="title-brace">{</span><span class="title-xmas">$1</span><span class="title-brace">}</span>');
  if (titleWithBraces !== titleEl.textContent) {
    titleEl.innerHTML = titleWithBraces;
  }
  
  // Set the logo image
  document.getElementById('logo').src = THEME_CONFIG.LOGO_PATH;
}


function initEventListeners() {
  const searchInput = document.getElementById('search');
  document.addEventListener('keydown', (e) => {
    // Don't auto-focus search if form is open
    if (isFormOpen) {
      return;
    }
    
    const isTypingKey = e.key.length === 1 || e.key === 'Backspace';

    if (document.activeElement !== searchInput && isTypingKey) {
      searchInput.focus();
    }
  });

  selectedGenrePill = document.getElementById("selectedGenrePill");

  selectedGenrePill.addEventListener("click", resetGenreFilter);

  // Enhanced search with intelligent filtering
  const searchEl = document.getElementById("search");
  const clearBtn = document.getElementById("clearSearchBtn");
  searchEl.addEventListener("input", e => {
    // Don't process search if song request form is open
    if (isFormOpen) {
      return;
    }
    const query = e.target.value.trim();
    handleSearch(query, true);
  });
  clearBtn.addEventListener("click", () => {
    searchEl.value = "";
    resetGenreFilter();
    handleSearch("", true);
  });
  // Filter button and genre menu logic
  const filterBtn = document.getElementById("filterBtn");
  const genreMenu = document.getElementById("genreMenu");
  filterBtn.addEventListener("click", () => {
    genreMenu.style.display = genreMenu.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", (e) => {
    if (!filterBtn.contains(e.target) && !genreMenu.contains(e.target)) {
      genreMenu.style.display = "none";
    }
  });
  genreMenu.addEventListener("click", (e) => {
    const genre = e.target.getAttribute("data-genre");
    if (genre !== null) {
      selectedGenre = genre;
      genreMenu.style.display = "none";
      const query = document.getElementById("search").value.trim();
      handleSearch(query, true);
      // Highlight selected genre
      genreMenu.querySelectorAll('[data-genre]').forEach(el => {
        el.style.background = el.getAttribute("data-genre") === genre ? "#cd6391" : "#fff";
        el.style.color = el.getAttribute("data-genre") === genre ? "#fff" : "#4E4E4E";
      });
      // Show pill if not empty
      if (genre && genre !== "") {
        selectedGenrePill.textContent = genre;
        selectedGenrePill.style.display = "inline-block";
      } else {
        selectedGenrePill.style.display = "none";
      }
    }
  });

  // Infinite scroll for autoloading more songs
  document.getElementById("videoList").addEventListener("scroll", function() {
    const container = this;
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
      // Near bottom
      if (currentOffset + CONFIG.BATCH_SIZE < currentVideos.length) {
        currentOffset += CONFIG.BATCH_SIZE;
        if (currentMode === "random") {
          showRandomVideos(false);
        } else {
          handleSearch(currentSearchQuery, false);
        }
      }
    }
  });

  // Mouse movement handling for video player
  document.addEventListener("mousemove", () => {
    const container = document.getElementById("playerContainer");
    const btn = document.getElementById("closeBtn");
    const overlay = document.getElementById("videoOverlay");

    if (container.style.display === "flex") {
      // Show cursor, button, and controls on mouse movement
      container.classList.add("show-cursor");
      btn.classList.add("visible");
      overlay.classList.add("visible");

      // Hide again after 3 seconds of no movement
      clearTimeout(window.hideTimer);
      window.hideTimer = setTimeout(() => {
        container.classList.remove("show-cursor");
        btn.classList.remove("visible");
        overlay.classList.remove("visible");
      }, 3000);
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", e => {
    // Don't process keyboard shortcuts if form is open (except Escape to close)
    if (isFormOpen && e.key !== "Escape") {
      return;
    }
    
    const playerContainer = document.getElementById("playerContainer");
    const statsPage = document.getElementById("statsPage");
    const searchField = document.getElementById("search");

    if (e.key === "Escape") {
      // If song request form is open, close it first
      if (isFormOpen) {
        closeRequestForm();
      }
      // If video is playing, close it
      else if (playerContainer.style.display === "flex") {
        closePlayer();
      }
      // If stats page is open, close it
      else if (statsPage.style.display === "block") {
        statsPage.style.display = "none";
      }
      // If neither video nor stats are open, clear search field
      else {
        searchField.value = "";
        showRandomVideos();
      }
    }
    // Clear search with Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchField.value = "";
      showRandomVideos();
      searchField.focus();
    }
  });

  // Statistics functionality
  document.getElementById("statsButton").onclick = () => {
    document.getElementById("statsPage").style.display = "block";
    renderChart();
  };

  document.getElementById("closeStats").onclick = () => {
    document.getElementById("statsPage").style.display = "none";
  };
}


function main() {
  // Initialize theme on page load
  initializeTheme();

  // Initialize the application
  loadVideos();

  initEventListeners();
}