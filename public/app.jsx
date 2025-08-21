const { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } = React;

/* ========= Utilidades ========= */

// Hook personalizado para detectar pantallas de tamaño móvil
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

function canFullscreen() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled);
}

function computePageSize(containerW, containerH) {
  const pageRatio = 8.5 / 11;
  const bookRatio = pageRatio * 2;
  if (!containerW || !containerH) return { w: 0, h: 0 };

  if (containerW / containerH > bookRatio) {
    const h = Math.floor(containerH * 0.85);
    const w = Math.floor(h * pageRatio);
    return { w, h };
  } else {
    const w_total = Math.floor(containerW * 0.85);
    const w = Math.floor(w_total / 2);
    const h = Math.floor(w / pageRatio);
    return { w, h };
  }
}

function useResizeTarget(ref) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => force(x => x + 1));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
}

async function enterFullscreen(el) {
  try {
    if (el.requestFullscreen) return await el.requestFullscreen();
    if (el.webkitRequestFullscreen) return await el.webkitRequestFullscreen();
    if (el.msRequestFullscreen) return await el.msRequestFullscreen();
  } catch (e) {
    console.warn('Fullscreen request failed:', e);
  }
}

async function exitFullscreen() {
  try {
    if (document.exitFullscreen) return await document.exitFullscreen();
    if (document.webkitExitFullscreen) return await document.webkitExitFullscreen();
    if (document.msExitFullscreen) return await document.msExitFullscreen();
  } catch (e) {
    console.warn('Exit fullscreen failed:', e);
  }
}


/* ========= Componentes de UI ========= */

// Componente para la pantalla de aviso en móviles
function MobileWarningScreen({ imagePath }) {
  return (
    <div className="mobile-warning-screen">
      <img src={imagePath} alt="Esta aplicación está diseñada para computadoras de escritorio." />
    </div>
  );
}

// Componente para la pantalla de carga
function LoadingScreen({ progress, isHiding }) {
  return (
    <div className={`loading-screen ${isHiding ? 'hidden' : ''}`}>
      <h1>Broken Orbit - Showcase 2025</h1>
      <div className="progress-bar">
        <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
}

// Componente para el fondo dinámico
function StageBackground({ backgroundMap, defaultBackground, currentPage }) {
  const [layers, setLayers] = useState([
    { url: defaultBackground, visible: true },
    { url: null, visible: false },
  ]);
  const activeLayerIndex = useRef(0);

  useEffect(() => {
    let targetUrl = defaultBackground;
    for (let i = currentPage; i >= 0; i--) {
      if (backgroundMap.hasOwnProperty(i)) {
        targetUrl = backgroundMap[i];
        break;
      }
    }

    const visibleLayer = layers[activeLayerIndex.current];
    if (visibleLayer.url === targetUrl) return;

    const hiddenLayerIndex = 1 - activeLayerIndex.current;
    activeLayerIndex.current = hiddenLayerIndex;

    setLayers(prevLayers => {
      const newLayers = [...prevLayers];
      newLayers[hiddenLayerIndex] = { url: targetUrl, visible: true };
      newLayers[1 - hiddenLayerIndex] = { ...newLayers[1 - hiddenLayerIndex], visible: false };
      return newLayers;
    });
  }, [currentPage, backgroundMap, defaultBackground]);

  return (
    <div className="stage-background">
      {layers.map((layer, index) => (
        <div
          key={index}
          className="bg-layer"
          style={{
            backgroundImage: layer.url ? `url(${layer.url})` : 'none',
            opacity: layer.visible ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}

// Componente para gestionar el audio
function AudioManager({ backgroundTrack, sfxMap, currentPage }) {
  const bgmAudioRef = useRef(null);
  const sfxAudioRef = useRef(null);
  const currentSfxUrl = useRef(null);
  const fadeInterval = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const fadeAudio = (audioEl, targetVolume, duration = 1000, onComplete = null) => {
    clearInterval(fadeInterval.current);
    if (!audioEl) return;
    const startVolume = audioEl.volume;
    const stepTime = 50;
    const steps = duration / stepTime;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;
    fadeInterval.current = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        audioEl.volume = targetVolume;
        clearInterval(fadeInterval.current);
        if (onComplete) onComplete();
      } else {
        audioEl.volume += volumeStep;
      }
    }, stepTime);
  };

  useEffect(() => {
    const startAudio = async () => {
      if (hasInteracted) return;
      setHasInteracted(true);
      if (bgmAudioRef.current) {
        try {
          bgmAudioRef.current.volume = 0.2;
          await bgmAudioRef.current.play();
        } catch (error) {
          console.warn("La reproducción automática de BGM fue bloqueada.");
        }
      }
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('click', startAudio);
    window.addEventListener('keydown', startAudio);
    return () => {
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
  }, [hasInteracted]);

  useEffect(() => {
    if (!hasInteracted || isMuted) return;
    let targetSfxUrl = null;
    for (let i = currentPage; i >= 0; i--) {
      if (sfxMap.hasOwnProperty(i)) {
        targetSfxUrl = sfxMap[i];
        break;
      }
    }
    if (targetSfxUrl === currentSfxUrl.current) return;
    const sfxPlayer = sfxAudioRef.current;
    const playNewTrack = () => {
      currentSfxUrl.current = targetSfxUrl;
      if (targetSfxUrl) {
        sfxPlayer.src = targetSfxUrl;
        sfxPlayer.loop = true;
        sfxPlayer.play().catch(err => console.error("SFX play failed:", err));
        fadeAudio(sfxPlayer, 0.5, 1000);
      }
    };
    if (currentSfxUrl.current) {
      fadeAudio(sfxPlayer, 0, 1000, () => {
        sfxPlayer.pause();
        playNewTrack();
      });
    } else {
      playNewTrack();
    }
  }, [currentPage, hasInteracted, isMuted, sfxMap]);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (bgmAudioRef.current) bgmAudioRef.current.muted = newMutedState;
    if (sfxAudioRef.current) sfxAudioRef.current.muted = newMutedState;
    if (!newMutedState && bgmAudioRef.current && bgmAudioRef.current.paused) {
      bgmAudioRef.current.play().catch(e => console.warn("No se pudo reanudar BGM", e));
    }
  };

  return (
    <>
      <audio ref={bgmAudioRef} src={backgroundTrack} loop preload="auto" />
      <audio ref={sfxAudioRef} preload="auto" />
      {hasInteracted && (
        <div className="music-control">
          <button className="btn" onClick={toggleMute} title={isMuted ? "Activar sonido" : "Silenciar sonido"}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}
    </>
  );
}

// Componente individual de botón para la barra de navegación (con efecto fade-in)
function NavButton({ label, page, onNavigate }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      className="btn"
      onClick={() => onNavigate(page)}
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.8s ease-in-out',
      }}
    >
      {label}
    </button>
  );
}

// Componente de la barra de navegación progresiva
function NavBar({ onNavigate, maxPageVisited }) {
  const navLinks = [
    { label: 'Cover', page: 0 },
    { label: 'E', page: 3 },
    { label: 'Mkins', page: 9 },
    { label: 'Krag', page: 17 },
    { label: 'Seven', page: 25 },
    { label: 'Sylas', page: 33 },
    { label: 'Green City', page: 39 },
  ];

  const isBarVisible = maxPageVisited > 0;
  const unlockedLinks = navLinks.filter(link => link.page <= maxPageVisited);

  return (
    <footer
      className="nav-bar"
      style={{
        opacity: isBarVisible ? 1 : 0,
        pointerEvents: isBarVisible ? 'auto' : 'none',
      }}
    >
      {unlockedLinks.map(({ label, page }) => (
        <NavButton key={label} label={label} page={page} onNavigate={onNavigate} />
      ))}
    </footer>
  );
}

// Componente principal del libro interactivo
const FlipBook = forwardRef(({ pagePairsCount = 25, pathPrefix = 'assets/', onPageFlip = () => {}, currentPage = 0 }, ref) => {
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const pageFlipRef = useRef(null);
  const [fsAvail, setFsAvail] = useState(canFullscreen());
  const [ready, setReady] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [bookSize, setBookSize] = useState({ w: 0, h: 0 });
  const [isBookPrepared, setIsBookPrepared] = useState(false);
  const pageFlipAudioRef = useRef(null);
  const coverAudioRef = useRef(null);
  useResizeTarget(stageRef);

  const pagesSrc = useMemo(() => {
    const sources = [];
    sources.push(`${pathPrefix}cover.webp`);
    for (let i = 1; i <= pagePairsCount; i++) {
      sources.push(`${pathPrefix}l${i}.webp`);
      sources.push(`${pathPrefix}r${i}.webp`);
    }
    sources.push(`${pathPrefix}back.webp`);
    return sources;
  }, [pagePairsCount, pathPrefix]);

  useImperativeHandle(ref, () => ({
    flipToPage(pageNumber) {
      if (pageFlipRef.current) {
        if (currentPage === 0 && !isBookPrepared && pageNumber > 0) {
          handlePrepareBook(null, () => pageFlipRef.current.flip(pageNumber));
        } else {
          pageFlipRef.current.flip(pageNumber);
        }
      }
    }
  }));

  useEffect(() => {
    let cancelled = false;
    function init() {
      if (!hostRef.current || pageFlipRef.current) return;
      const r = stageRef.current?.getBoundingClientRect?.();
      if (!r || !r.width || !r.height) return requestAnimationFrame(init);
      const { w, h } = computePageSize(r.width, r.height);
      if (!w || !h) return requestAnimationFrame(init);
      setBookSize({ w, h });
      const pageElements = pagesSrc.map(src => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        const img = document.createElement('img');
        img.src = src;
        img.draggable = false;
        pageDiv.appendChild(img);
        return pageDiv;
      });
      pageFlipRef.current = new St.PageFlip(hostRef.current, { width: w, height: h, usePortrait: false, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.7, useMouseEvents: true });
      pageFlipRef.current.loadFromHTML(pageElements);
      pageFlipAudioRef.current = new Audio(`${pathPrefix}page-flip.mp3`);
      coverAudioRef.current = new Audio(`${pathPrefix}cover.mp3`);
      pageFlipRef.current.on('changeState', (e) => {
        if (e.data === 'flipping') {
          setIsFlipping(true);
          const api = pageFlipRef.current;
          const cp = api.getCurrentPageIndex();
          if (cp <= 1 || cp >= api.getPageCount() - 2) {
            const sound = coverAudioRef.current.cloneNode();
            sound.volume = 0.5;
            sound.play().catch(err => { if (err.name !== 'NotAllowedError') console.error("Audio play failed:", err); });
          } else {
            const sound = pageFlipAudioRef.current.cloneNode();
            sound.volume = 0.5;
            sound.play().catch(err => { if (err.name !== 'NotAllowedError') console.error("Audio play failed:", err); });
          }
        }
      });
      pageFlipRef.current.on('flip', (e) => {
        setIsFlipping(false);
        onPageFlip(e.data);
      });
      hostRef.current.classList.add('frame');
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, [pagesSrc, onPageFlip, pathPrefix]);

  useEffect(() => {
    function onResize() {
      if (!stageRef.current || !pageFlipRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const { w, h } = computePageSize(rect.width, rect.height);
      if (w && h) {
        pageFlipRef.current.update({ width: w, height: h });
        setBookSize({ w, h });
      }
    }
    window.addEventListener('resize', onResize);
    const id = requestAnimationFrame(onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (!hostRef.current || !pageFlipRef.current || !bookSize.w) return;
    const isClosedAtStart = currentPage === 0;
    const isClosedAtEnd = currentPage === pageFlipRef.current.getPageCount() - 1;
    const bookElement = hostRef.current;
    if (isClosedAtStart) {
      setIsBookPrepared(false);
      bookElement.style.transform = `translateX(-${bookSize.w / 2}px)`;
    } else if (isClosedAtEnd) {
      bookElement.style.transform = `translateX(${bookSize.w / 2}px)`;
    } else {
      setIsBookPrepared(true);
      bookElement.style.transform = 'translateX(0)';
    }
  }, [currentPage, bookSize, ready]);

  const handlePrepareBook = (e, onComplete = null) => {
    e?.stopPropagation();
    if (!isBookPrepared && hostRef.current && pageFlipRef.current) {
      const bookElement = hostRef.current;
      const onSlideComplete = () => {
        if (onComplete) {
          onComplete();
        } else {
          pageFlipRef.current?.flipNext();
        }
      };
      bookElement.addEventListener('transitionend', onSlideComplete, { once: true });
      setIsBookPrepared(true);
      bookElement.style.transform = 'translateX(0)';
    }
  };

  const handleFlipNext = () => {
    if (isFlipping || !pageFlipRef.current) return;
    const totalPages = pageFlipRef.current.getPageCount();
    if (currentPage === totalPages - 1) {
      pageFlipRef.current.flip(0);
    } else {
      pageFlipRef.current.flipNext();
    }
  };

  const handleFlipPrev = () => {
    if (!isFlipping) pageFlipRef.current?.flipPrev();
  };

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') {
        if (currentPage === 0 && !isBookPrepared) {
          handlePrepareBook(e);
        } else {
          handleFlipNext();
        }
      } else if (e.key === 'ArrowLeft') {
        handleFlipPrev();
      } else if (e.key.toLowerCase?.() === 'f' && fsAvail) {
        if (!document.fullscreenElement) {
          enterFullscreen(document.documentElement);
        } else {
          exitFullscreen();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fsAvail, isFlipping, currentPage, isBookPrepared]);

  const showInterceptor = currentPage === 0 && !isBookPrepared && ready;

  return (
    <main ref={stageRef} className="stage">
      <div className="book-wrapper">
        {showInterceptor && <div className="click-interceptor" onClick={handlePrepareBook} />}
        {showInterceptor && (
          <div className="open-book-indicator">
            <span className="chevron">&laquo;</span>
            <span className="chevron">&laquo;</span>
            <span className="chevron">&laquo;</span>
          </div>
        )}
        <div id="book" ref={hostRef}></div>
      </div>
    </main>
  );
});


/* ========= APP PRINCIPAL ========= */

function App() {
  const PAGE_PAIRS = 25;
  const ASSETS_PATH = "assets/";
  const isMobile = useIsMobile();

  // Si es móvil, renderiza la advertencia y detiene la ejecución.
  if (isMobile) {
    return <MobileWarningScreen imagePath={`${ASSETS_PATH}mobile.webp`} />;
  }

  // ---- Todo el código a continuación solo se ejecutará en escritorio ----
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isHidingLoader, setIsHidingLoader] = useState(false);
  const bookApiRef = useRef(null);
  const [maxPageVisited, setMaxPageVisited] = useState(0);

  useEffect(() => {
    if (currentPage > maxPageVisited) {
      setMaxPageVisited(currentPage);
    }
  }, [currentPage, maxPageVisited]);

  const backgroundMap = { 0: `${ASSETS_PATH}bg1.webp`, 5: `${ASSETS_PATH}bg5.webp`, 10: `${ASSETS_PATH}bg10.webp`, 17: `${ASSETS_PATH}bgrocks.webp`, 25: `${ASSETS_PATH}bgcity.webp`, 33: `${ASSETS_PATH}bgforest.webp`, 39: `${ASSETS_PATH}bggreen.webp`, 43: `${ASSETS_PATH}bgred.webp`, 45: `${ASSETS_PATH}bggreen.webp`, 47: `${ASSETS_PATH}bg1.webp` };
  const defaultBackground = null;
  const backgroundTrack = `${ASSETS_PATH}background.mp3`;
  const sfxMap = { 0: null, 1: `${ASSETS_PATH}regular.mp3`, 5: `${ASSETS_PATH}crash.mp3`, 7: `${ASSETS_PATH}mkin.mp3`, 17: `${ASSETS_PATH}krag.mp3`, 27: `${ASSETS_PATH}robot.mp3`, 33: `${ASSETS_PATH}cry.mp3`, 39: `${ASSETS_PATH}boop.mp3`, 43: `${ASSETS_PATH}error.mp3`, 45: `${ASSETS_PATH}green.mp3`, 48: null };

  useEffect(() => {
    const preloadAssets = async () => {
      const imageSources = [ ...Object.values(backgroundMap).filter(Boolean), `${ASSETS_PATH}cover.webp`, `${ASSETS_PATH}back.webp` ];
      for (let i = 1; i <= PAGE_PAIRS; i++) { imageSources.push(`${ASSETS_PATH}l${i}.webp`); imageSources.push(`${ASSETS_PATH}r${i}.webp`); }
      const audioSources = [ ...Object.values(sfxMap).filter(Boolean), backgroundTrack, `${ASSETS_PATH}page-flip.mp3`, `${ASSETS_PATH}cover.mp3` ];
      const totalAssets = imageSources.length + audioSources.length;
      let loadedAssets = 0;
      const updateProgress = () => { loadedAssets++; setLoadingProgress((loadedAssets / totalAssets) * 100); };
      
      const imagePromises = imageSources.map(src => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => { updateProgress(); resolve(); };
          img.onerror = () => { updateProgress(); resolve(); };
        });
      });

      // ESTA ES LA SECCIÓN CORREGIDA Y FORMATEADA
      const audioPromises = audioSources.map(src => {
        return new Promise((resolve) => {
          const audio = new Audio();
          audio.src = src;
          
          const onAudioReady = () => {
            updateProgress();
            resolve();
            audio.removeEventListener('canplaythrough', onAudioReady);
            audio.removeEventListener('error', onAudioReady);
          };

          audio.addEventListener('canplaythrough', onAudioReady);
          audio.addEventListener('error', onAudioReady);
        });
      });

      await Promise.all([...imagePromises, ...audioPromises]);

      setIsHidingLoader(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    };

    preloadAssets();
  }, []);

  const handleNavigate = (pageNumber) => {
    bookApiRef.current?.flipToPage(pageNumber);
  };

  return (
    <>
      {isLoading && <LoadingScreen progress={loadingProgress} isHiding={isHidingLoader} />}
      <StageBackground backgroundMap={backgroundMap} defaultBackground={defaultBackground} currentPage={currentPage} />
      <FlipBook ref={bookApiRef} pagePairsCount={PAGE_PAIRS} pathPrefix={ASSETS_PATH} onPageFlip={setCurrentPage} currentPage={currentPage} />
      <AudioManager backgroundTrack={backgroundTrack} sfxMap={sfxMap} currentPage={currentPage} />
      <NavBar onNavigate={handleNavigate} maxPageVisited={maxPageVisited} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);