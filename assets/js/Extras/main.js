document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE_URL = `http://${window.location.hostname}:3300`;

  const librarySelect = document.getElementById('librarySelect');
  const categorySelect = document.getElementById('categorySelect');
  const videoSelect = document.getElementById('videoSelect');
  const container = document.getElementById('videoComparisonContainer');

  // Internal state:
  // categoryToVideos: Map<string, Map<string, VideoEntry>>
  // where VideoEntry = { name, category, resolutions[], sources }
  // libraryData: { videos: Map(cat->Map(name->entry)), video_enfant: Map(...), video_creative_common: Map(...) }
  const libraryData = {
    videos: new Map(),
    video_enfant: new Map(),
    video_creative_common: new Map(),
  };

  function setVideoSelectEnabled(enabled) {
    videoSelect.disabled = !enabled;
    if (enabled) {
      videoSelect.style.background = '';
      videoSelect.style.color = '';
    } else {
      videoSelect.style.background = '#eee';
      videoSelect.style.color = '#666';
    }
  }

  function fillCategoryOptions(categories) {
    const sorted = Array.from(categories).sort((a, b) => a.localeCompare(b));
    // Keep the placeholder, then append
    sorted.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }

  function fillVideoOptionsForCategory(category) {
    // Reset list with placeholder
    videoSelect.innerHTML = '<option value="">-- Choisir une vidéo --</option>';
    const map = categoryToVideos.get(category) || new Map();
    const names = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      videoSelect.appendChild(opt);
    });
  }

  async function fetchVideos(endpoint) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('Erreur de chargement des vidéos:', e);
      return [];
    }
  }

  // Load catalogs: include adult (with licensed), adult base only, and enfant
  const [adultAll, adultBase, childVideos] = await Promise.all([
    fetchVideos(`${API_BASE_URL}/api/get-videos?mode=adulte&includeLicensed=true`),
    fetchVideos(`${API_BASE_URL}/api/get-videos?mode=adulte&includeLicensed=false`),
    fetchVideos(`${API_BASE_URL}/api/get-videos?mode=enfant`),
  ]);

  // Helper: list -> Map(cat->Map(name->entry))
  function listToCategoryMap(list) {
    const map = new Map();
    list.forEach(v => {
      const cat = v.category || 'Autre';
      const name = v.name || '';
      if (!name) return;
      if (!map.has(cat)) map.set(cat, new Map());
      map.get(cat).set(name, v);
    });
    return map;
  }

  // Compute licensed-only as adultAll minus adultBase by id
  const baseIds = new Set(adultBase.map(v => v.id));
  const licensedOnly = adultAll.filter(v => !baseIds.has(v.id));

  libraryData.video_creative_common = listToCategoryMap(adultBase);
  libraryData.videos = listToCategoryMap(licensedOnly);
  libraryData.video_enfant = listToCategoryMap(childVideos);

  // Fill category dropdown
  function resetCategoryAndVideo() {
    // Reset category options (keep placeholder)
    categorySelect.innerHTML = '<option value="">-- Choisir une catégorie --</option>';
    // Reset video options
    videoSelect.innerHTML = '<option value="">-- Choisir une vidéo --</option>';
    setVideoSelectEnabled(false);
  }

  function populateCategoriesForLibrary(libKey) {
    resetCategoryAndVideo();
    const catMap = libraryData[libKey] || new Map();
    fillCategoryOptions(catMap.keys());
  }

  // Initialize with default selection
  populateCategoriesForLibrary(librarySelect.value || 'video_creative_common');

  // Hook up interactions
  setVideoSelectEnabled(false);
  librarySelect.addEventListener('change', () => {
    if (container) container.innerHTML = '';
    populateCategoriesForLibrary(librarySelect.value);
  });
  categorySelect.addEventListener('change', () => {
    const selected = categorySelect.value;
    if (!selected) {
      setVideoSelectEnabled(false);
      videoSelect.value = '';
      videoSelect.innerHTML = '<option value="">-- Choisir une vidéo --</option>';
      if (container) container.innerHTML = '';
      return;
    }
    const catMap = libraryData[librarySelect.value] || new Map();
    // Reset list with placeholder
    videoSelect.innerHTML = '<option value="">-- Choisir une vidéo --</option>';
    const names = Array.from((catMap.get(selected) || new Map()).keys()).sort((a, b) => a.localeCompare(b));
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      videoSelect.appendChild(opt);
    });
    setVideoSelectEnabled(true);
  });

  // --- Helpers from Results page (adapted) ---
  function detectDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'pc';
  }

  function calculateRecommendedResolution(satisfactionData, deviceType, availableResolutions) {
    if (!satisfactionData || !deviceType || !availableResolutions || availableResolutions.length === 0) {
      return null;
    }
    const sortedResolutions = [...availableResolutions].sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
    let recommendedRes = null;
    for (const res of sortedResolutions) {
      const deviceStats = satisfactionData[res]?.[deviceType];
      if (deviceStats) {
        const verySatisfactory = deviceStats.verysatisfactory || 0;
        const correct = deviceStats.correct || 0;
        const total = Object.values(deviceStats).reduce((sum, count) => sum + count, 0);
        if (total > 0) {
          const positivePercentage = ((verySatisfactory + correct) / total) * 100;
          if (positivePercentage >= 70) {
            recommendedRes = res;
            break;
          }
        }
      }
    }
    if (!recommendedRes) {
      const resolutionsUpTo1080p = sortedResolutions.filter(res => RESOLUTION_ORDER.indexOf(res) <= RESOLUTION_ORDER.indexOf('1080p'));
      if (resolutionsUpTo1080p.length > 0) {
        recommendedRes = resolutionsUpTo1080p[resolutionsUpTo1080p.length - 1];
      } else {
        recommendedRes = sortedResolutions[0];
      }
    }
    return recommendedRes;
  }

  function createTopBar(res, isRecommended, deviceDisplayName, onFullscreen) {
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.justifyContent = 'space-between';
    bar.style.alignItems = 'center';
    bar.style.marginBottom = '6px';
    const left = document.createElement('div');
    left.textContent = `Résolution: ${res}`;
    const right = document.createElement('div');
    if (isRecommended) {
      const badge = document.createElement('span');
      badge.textContent = `🌟 Conseillée sur ${deviceDisplayName}`;
      badge.style.background = '#fff3cd';
      badge.style.color = '#664d03';
      badge.style.border = '1px solid #ffc107';
      badge.style.borderRadius = '6px';
      badge.style.padding = '2px 8px';
      badge.style.marginRight = '8px';
      right.appendChild(badge);
    }
    const fsBtn = document.createElement('button');
    fsBtn.className = 'small-button';
    fsBtn.textContent = 'Plein écran';
    fsBtn.addEventListener('click', onFullscreen);
    right.appendChild(fsBtn);
    bar.append(left, right);
    return bar;
  }

  function requestFullscreen(el) {
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }

  // Render grid when a video is selected
  videoSelect.addEventListener('change', async () => {
    if (!container) return;
    container.innerHTML = '';
    const category = categorySelect.value;
    const videoName = videoSelect.value;
    if (!category || !videoName) return;

    const videoEntry = (libraryData[librarySelect.value] || new Map()).get(category)?.get(videoName);
    if (!videoEntry) return;

    // Gather available resolutions and satisfaction data
    let availableResolutions = await getVideoResolutions(videoName);
    if (!Array.isArray(availableResolutions)) availableResolutions = [];
    availableResolutions = availableResolutions.filter(r => RESOLUTION_ORDER.includes(r))
      .sort((a, b) => RESOLUTION_ORDER.indexOf(a) - RESOLUTION_ORDER.indexOf(b));
  const satisfactionData = await getSatisfactionByVideoAndDevice(encodeURIComponent(videoName));

    const device = detectDeviceType();
    const deviceDisplayName = device === 'tablet' ? 'Tablette' : device.charAt(0).toUpperCase() + device.slice(1);
    const recommended = calculateRecommendedResolution(satisfactionData, device, availableResolutions);

    // Grid container
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    grid.style.gap = '14px';

  // Keep references to synchronize play/pause
  const players = [];
  let syncing = false;

    // Toolbar for global controls
    const toolbar = document.createElement('div');
    toolbar.style.display = 'flex';
    toolbar.style.gap = '8px';
    toolbar.style.alignItems = 'center';
    toolbar.style.margin = '8px 0 12px 0';
    const playAllBtn = document.createElement('button');
    playAllBtn.className = 'small-button';
    playAllBtn.textContent = '▶️ Lecture (toutes)';
    playAllBtn.addEventListener('click', () => {
      syncing = true;
      const playPromises = players.map(p => p.play().catch(() => {}));
      Promise.allSettled(playPromises).finally(() => { syncing = false; });
    });
    const pauseAllBtn = document.createElement('button');
    pauseAllBtn.className = 'small-button';
    pauseAllBtn.textContent = '⏸ Pause (toutes)';
    pauseAllBtn.addEventListener('click', () => {
      syncing = true;
      players.forEach(p => { if (!p.paused) p.pause(); });
      syncing = false;
    });
    toolbar.append(playAllBtn, pauseAllBtn);

    for (const res of availableResolutions) {
      const wrapper = document.createElement('div');
      wrapper.style.border = '1px solid var(--border-color-light)';
      wrapper.style.borderRadius = '8px';
      wrapper.style.padding = '10px';
      wrapper.style.background = 'var(--card-bg)';

      const src = videoEntry.sources?.[res];
      if (!src) continue;

      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.borderRadius = '6px';

      const onFullscreen = () => requestFullscreen(video);
      const topBar = createTopBar(res, res === recommended, deviceDisplayName, onFullscreen);

      // Sync: pausing one pauses all; playing one plays all
      video.addEventListener('pause', () => {
        if (syncing) return;
        syncing = true;
        players.forEach(p => { if (!p.paused) p.pause(); });
        syncing = false;
      });
      video.addEventListener('play', () => {
        if (syncing) return;
        syncing = true;
        const playPromises = players.map(p => p.play().catch(() => {}));
        Promise.allSettled(playPromises).finally(() => { syncing = false; });
      });

      players.push(video);
      wrapper.append(topBar, video);
      grid.appendChild(wrapper);
    }

  container.appendChild(toolbar);
  container.appendChild(grid);

    // --- Statistiques de satisfaction pour cette vidéo (sous les vidéos) ---
    // Transformer les données de satisfaction (résolution -> appareil) vers (appareil -> résolution)
    function transformToDeviceFirst(resolutionFirst) {
      const deviceFirst = {};
      Object.keys(resolutionFirst || {}).forEach(res => {
        const byDevice = resolutionFirst[res] || {};
        Object.keys(byDevice).forEach(device => {
          if (!deviceFirst[device]) deviceFirst[device] = {};
          deviceFirst[device][res] = byDevice[device];
        });
      });
      return deviceFirst;
    }

    function deviceHasData(deviceObj) {
      if (!deviceObj) return false;
      return Object.keys(deviceObj).some(res => {
        const counts = deviceObj[res] || {};
        return Object.values(counts).some(v => Number(v) > 0);
      });
    }

    const deviceFirstData = transformToDeviceFirst(satisfactionData || {});

    const statsSection = document.createElement('section');
    statsSection.style.marginTop = '18px';
    const statsTitle = document.createElement('h3');
    statsTitle.textContent = 'Statistiques de satisfaction pour cette vidéo';
    statsTitle.style.margin = '6px 0 12px 0';
    statsSection.appendChild(statsTitle);

    const chartsContainer = document.createElement('div');
    chartsContainer.id = 'extrasSatisfactionCharts';
    chartsContainer.style.display = 'grid';
  chartsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
    chartsContainer.style.gap = '14px';
    statsSection.appendChild(chartsContainer);

    const expectedDevices = ['pc', 'mobile', 'tablet'];
    expectedDevices.forEach(dev => {
      const sub = document.createElement('div');
      sub.className = 'device-stats-block';
      sub.style.background = 'var(--card-bg)';
      sub.style.border = '1px solid var(--border-color-light)';
      sub.style.borderRadius = '8px';
      sub.style.padding = '10px';

      const dataForDev = deviceFirstData[dev];
      if (deviceHasData(dataForDev)) {
        // Construire un objet restreint à cet appareil pour réutiliser le moteur de rendu existant
        const singleDeviceData = { [dev]: dataForDev };
        // Cette fonction vient de assets/js/Resultats/graphique.js
        try {
          afficherSatisfactionVideoParAppareil(sub, singleDeviceData, videoName);

          // Ajouter un bouton pour ouvrir le graphique dans une popup
          const chartWrapper = sub.querySelector('.dynamic-chart-wrapper');
          const canvas = chartWrapper ? chartWrapper.querySelector('canvas') : null;
          if (chartWrapper && canvas) {
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'flex-end';
            header.style.alignItems = 'center';
            header.style.marginBottom = '6px';

            const enlargeBtn = document.createElement('button');
            enlargeBtn.className = 'small-button';
            enlargeBtn.textContent = 'Agrandir';
            enlargeBtn.title = 'Ouvrir en grand dans une fenêtre';

            function openChartModal() {
              // Overlay
              const overlay = document.createElement('div');
              overlay.className = 'modal-overlay';
              overlay.setAttribute('role', 'dialog');
              overlay.setAttribute('aria-modal', 'true');

              // Content
              const content = document.createElement('div');
              content.className = 'modal-content';

              const headerBar = document.createElement('div');
              headerBar.className = 'modal-header';
              const title = document.createElement('h4');
              const deviceLabel = dev === 'mobile' ? 'téléphone' : (dev === 'tablet' ? 'tablette' : 'PC');
              title.textContent = `Satisfaction sur ${deviceLabel}`;
              const closeBtn = document.createElement('button');
              closeBtn.className = 'modal-close small-button';
              closeBtn.textContent = 'Fermer';
              headerBar.append(title, closeBtn);

              const body = document.createElement('div');
              body.className = 'modal-body';

              content.append(headerBar, body);
              overlay.appendChild(content);
              document.body.appendChild(overlay);

              // Empêcher scroll en arrière-plan
              const prevOverflow = document.body.style.overflow;
              document.body.style.overflow = 'hidden';

              // Rendu du graphique dans la popup (une seule entrée: le device courant)
              try {
                afficherSatisfactionVideoParAppareil(body, singleDeviceData, videoName);
                // Ajuster la hauteur du canvas pour plus de lisibilité
                const modalCanvas = body.querySelector('canvas');
                if (modalCanvas) {
                  modalCanvas.style.height = '520px';
                  setTimeout(() => {
                    try { const chart = Chart.getChart(modalCanvas); if (chart) chart.resize(); } catch(_){}
                  }, 0);
                }
              } catch (err) {
                console.error('Erreur rendu popup:', err);
                body.innerHTML = '<p style="text-align:center; color:#888; padding: 1rem;">Erreur lors de l\'affichage du graphique.</p>';
              }

              function closeModal() {
                // Détruire d\'abord le chart si présent
                const modalCanvas = body.querySelector('canvas');
                if (modalCanvas && window.Chart) {
                  const chart = Chart.getChart(modalCanvas);
                  if (chart) { try { chart.destroy(); } catch(_){} }
                }
                document.body.removeChild(overlay);
                document.body.style.overflow = prevOverflow;
                document.removeEventListener('keydown', onKeydown);
              }

              function onKeydown(e) { if (e.key === 'Escape') closeModal(); }
              document.addEventListener('keydown', onKeydown);
              closeBtn.addEventListener('click', closeModal);
              overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
            }

            enlargeBtn.addEventListener('click', openChartModal);
            header.appendChild(enlargeBtn);
            sub.insertBefore(header, sub.firstChild);
          }
        } catch (e) {
          console.error('Erreur lors du rendu du graphique de satisfaction:', e);
          sub.innerHTML = `<div class="dynamic-chart-wrapper"><p style="text-align:center; color:#888; padding: 0.75rem;">Erreur lors de l\'affichage du graphique pour cet appareil.</p></div>`;
        }
      } else {
        const readable = dev === 'mobile' ? 'téléphone' : (dev === 'tablet' ? 'tablette' : 'PC');
        sub.innerHTML = `<div class="dynamic-chart-wrapper"><p style="text-align:center; color:#888; padding: 0.75rem;">Pas assez de données pour ${readable} pour cette vidéo.</p></div>`;
      }
      chartsContainer.appendChild(sub);
    });

    container.appendChild(statsSection);



    // Attempt to auto-play all (muted) to align start
    setTimeout(() => {
      const playPromises = players.map(p => p.play().catch(() => {}));
      Promise.allSettled(playPromises);
    }, 400);
  });
});
