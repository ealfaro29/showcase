const { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } = React;

/* ========= Utilidades ========= */

// Hook personalizado para detectar pantallas de tamaño móvil
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => { const handleResize = () => setIsMobile(window.innerWidth < breakpoint); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, [breakpoint]);
  return isMobile;
}

function canFullscreen() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled); }
function computePageSize(containerW, containerH) { const pageRatio = 8.5 / 11; const bookRatio = pageRatio * 2; if (!containerW || !containerH) return { w: 0, h: 0 }; if (containerW / containerH > bookRatio) { const h = Math.floor(containerH * 0.85); const w = Math.floor(h * pageRatio); return { w, h }; } else { const w_total = Math.floor(containerW * 0.85); const w = Math.floor(w_total / 2); const h = Math.floor(w / pageRatio); return { w, h }; } }
function useResizeTarget(ref) { const [, force] = useState(0); useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver(() => force(x => x + 1)); ro.observe(ref.current); return () => ro.disconnect(); }, [ref]); }
async function enterFullscreen(el) { try { if (el.requestFullscreen) return await el.requestFullscreen(); if (el.webkitRequestFullscreen) return await el.webkitRequestFullscreen(); if (el.msRequestFullscreen) return await el.msRequestFullscreen(); } catch (e) { console.warn('Fullscreen request failed:', e); } }
async function exitFullscreen() { try { if (document.exitFullscreen) return await document.exitFullscreen(); if (document.webkitExitFullscreen) return await document.webkitExitFullscreen(); if (document.msExitFullscreen) return await document.msExitFullscreen(); } catch (e) { console.warn('Exit fullscreen failed:', e); } }

/* ========= Componentes de UI ========= */

function MobileWarningScreen({ imagePath }) { return (<div className="mobile-warning-screen"><img src={imagePath} alt="Esta aplicación está diseñada para computadoras de escritorio." /></div>); }
function LoadingScreen({ progress, isHiding }) { return (<div className={`loading-screen ${isHiding ? 'hidden' : ''}`}><h1>Broken Orbit - Showcase 2025</h1><div className="progress-bar"><div className="progress-bar-inner" style={{ width: `${progress}%` }}></div></div></div>); }
function StageBackground({ backgroundMap, defaultBackground, currentPage }) { const [layers, setLayers] = useState([{ url: defaultBackground, visible: true },{ url: null, visible: false }]); const activeLayerIndex = useRef(0); useEffect(() => { let targetUrl = defaultBackground; for (let i = currentPage; i >= 0; i--) { if (backgroundMap.hasOwnProperty(i)) { targetUrl = backgroundMap[i]; break; } } if (layers[activeLayerIndex.current].url === targetUrl) return; const hiddenLayerIndex = 1 - activeLayerIndex.current; activeLayerIndex.current = hiddenLayerIndex; setLayers(p => { const n = [...p]; n[hiddenLayerIndex] = { url: targetUrl, visible: true }; n[1 - hiddenLayerIndex] = { ...n[1 - hiddenLayerIndex], visible: false }; return n; }); }, [currentPage, backgroundMap, defaultBackground]); return (<div className="stage-background">{layers.map((layer, index) => (<div key={index} className="bg-layer" style={{ backgroundImage: layer.url ? `url(${layer.url})` : 'none', opacity: layer.visible ? 1 : 0 }} />))}</div>); }
function NavButton({ label, page, onNavigate }) { const [isVisible, setIsVisible] = useState(false); useEffect(() => { const timer = setTimeout(() => setIsVisible(true), 100); return () => clearTimeout(timer); }, []); return (<button className="btn" onClick={() => onNavigate(page)} style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }}>{label}</button>); }
function NavBar({ onNavigate, maxPageVisited }) { const navLinks = [ { label: 'Cover', page: 0 }, { label: 'E', page: 3 }, { label: 'Mkins', page: 9 }, { label: 'Krag', page: 17 }, { label: 'Seven', page: 25 }, { label: 'Sylas', page: 33 }, { label: 'Green City', page: 39 } ]; const isBarVisible = maxPageVisited > 0; const unlockedLinks = navLinks.filter(link => link.page <= maxPageVisited); return (<footer className="nav-bar" style={{ opacity: isBarVisible ? 1 : 0, pointerEvents: isBarVisible ? 'auto' : 'none' }}>{unlockedLinks.map(({ label, page }) => (<NavButton key={label} label={label} page={page} onNavigate={onNavigate} />))}</footer>); }

/* ========= GESTOR DE AUDIO (VERSIÓN MEJORADA) ========= */
const AudioManager = forwardRef(({ backgroundTrack, sfxMap, currentPage, isMuted, toggleMute }, ref) => {
  const bgmAudioRef = useRef(null);
  const sfxAudioRefs = useRef([React.createRef(), React.createRef()]);
  const activeSfxPlayerIndex = useRef(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  
  // Utilidad de Fading (reutilizable)
  const fadeAudio = (audioEl, targetVolume, duration = 1500) => {
    if (!audioEl) return;
    const startVolume = audioEl.volume;
    const stepTime = 50;
    const steps = duration / stepTime;
    if (steps <= 0) { audioEl.volume = targetVolume; return; }
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;
    // Limpia cualquier intervalo anterior en este elemento
    if (audioEl.fadeInterval) clearInterval(audioEl.fadeInterval);
    audioEl.fadeInterval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        audioEl.volume = targetVolume;
        clearInterval(audioEl.fadeInterval);
      } else {
        audioEl.volume += volumeStep;
      }
    }, stepTime);
  };

  // Función para reproducir sonidos de un solo uso (como pasar página)
  useImperativeHandle(ref, () => ({
    playOneShotSfx(url, volume = 0.4) {
      if (isMuted || !hasInteracted) return;
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(e => console.warn("One-shot SFX failed", e));
    }
  }));
  
  // Efecto para la interacción inicial del usuario
  useEffect(() => {
    const startAudio = async () => {
      if (hasInteracted) return;
      setHasInteracted(true);
      if (bgmAudioRef.current) {
        try {
          bgmAudioRef.current.volume = 0;
          await bgmAudioRef.current.play();
          if (!isMuted) {
            fadeAudio(bgmAudioRef.current, 0.4, 250); // Fade-in inicial
          }
        } catch (error) { console.warn("La reproducción automática de BGM fue bloqueada."); }
      }
      const cleanup = () => { window.removeEventListener('click', startAudio); window.removeEventListener('keydown', startAudio); };
      cleanup();
    };
    window.addEventListener('click', startAudio); window.addEventListener('keydown', startAudio);
    return () => { window.removeEventListener('click', startAudio); window.removeEventListener('keydown', startAudio); };
  }, [hasInteracted, isMuted]);

  // Efecto para gestionar el estado de silencio global
  useEffect(() => {
    const bgm = bgmAudioRef.current;
    if (!bgm || !hasInteracted) return;
    if (isMuted) { fadeAudio(bgm, 0); } 
    else { fadeAudio(bgm, 0.2); }
    // Silencia los SFX activos inmediatamente
    sfxAudioRefs.current.forEach(ref => { if(ref.current) ref.current.muted = isMuted; });
  }, [isMuted, hasInteracted]);

  // Efecto para el crossfade de los SFX ambientales
  useEffect(() => {
    if (!hasInteracted) return;
    let targetSfxUrl = null;
    for (let i = currentPage; i >= 0; i--) { if (sfxMap.hasOwnProperty(i)) { targetSfxUrl = sfxMap[i]; break; } }

    const currentPlayer = sfxAudioRefs.current[activeSfxPlayerIndex.current].current;
    if (currentPlayer && currentPlayer.src.endsWith(targetSfxUrl)) return;
    
    // Desvanece el reproductor actual
    if (currentPlayer) { fadeAudio(currentPlayer, 0); }

    // Prepara y desvanece el nuevo reproductor
    const nextPlayerIndex = 1 - activeSfxPlayerIndex.current;
    const nextPlayer = sfxAudioRefs.current[nextPlayerIndex].current;
    activeSfxPlayerIndex.current = nextPlayerIndex;

    if (nextPlayer && targetSfxUrl) {
      nextPlayer.src = targetSfxUrl;
      nextPlayer.loop = true;
      nextPlayer.volume = 0;
      nextPlayer.muted = isMuted;
      nextPlayer.play().catch(err => console.error("SFX play failed:", err));
      if (!isMuted) { fadeAudio(nextPlayer, 0.5); }
    }
  }, [currentPage, hasInteracted, isMuted]);

  // Lógica de pantalla completa
  const toggleFullscreen = () => { if (!isFullscreen) { enterFullscreen(document.documentElement); } else { exitFullscreen(); } };
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

   return (
    <>
      <audio ref={bgmAudioRef} src={backgroundTrack} loop preload="auto" />
      <audio ref={sfxAudioRefs.current[0]} preload="auto" />
      <audio ref={sfxAudioRefs.current[1]} preload="auto" />
      
      {/* --- CAMBIOS --- */}
      {/* 1. Se elimina la condición hasInteracted para que los botones sean siempre visibles. */}
      <div className="ui-controls">
        <button className="btn" onClick={toggleMute} title={isMuted ? "Activar sonido" : "Silenciar sonido"}>
          {/* 2. Se reemplazan los iconos por texto dinámico. */}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button className="btn" onClick={toggleFullscreen} title="Pantalla completa">
          {/* 3. Se reemplazan los iconos por texto dinámico. */}
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>
      {/* --- FIN DE CAMBIOS --- */}
    </>
  );
});

/* ========= Componente del Libro Interactivo ========= */
const FlipBook = forwardRef(({ pagePairsCount = 25, pathPrefix = 'assets/', onPageFlip = () => {}, currentPage = 0, audioApiRef }, ref) => {
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const pageFlipRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [bookSize, setBookSize] = useState({ w: 0, h: 0 });
  const [isBookPrepared, setIsBookPrepared] = useState(false);
  useResizeTarget(stageRef);

  const pagesSrc = useMemo(() => { const sources = []; sources.push(`${pathPrefix}cover.webp`); for (let i = 1; i <= pagePairsCount; i++) { sources.push(`${pathPrefix}l${i}.webp`); sources.push(`${pathPrefix}r${i}.webp`); } sources.push(`${pathPrefix}back.webp`); return sources; }, [pagePairsCount, pathPrefix]);
  
  useImperativeHandle(ref, () => ({ flipToPage(pageNumber) { if (pageFlipRef.current) { if (currentPage === 0 && !isBookPrepared && pageNumber > 0) { handlePrepareBook(null, () => pageFlipRef.current.flip(pageNumber)); } else { pageFlipRef.current.flip(pageNumber); } } } }));

  useEffect(() => {
    let cancelled = false;
    function init() {
      if (!hostRef.current || pageFlipRef.current) return;
      const r = stageRef.current?.getBoundingClientRect?.();
      if (!r || !r.width || !r.height) return requestAnimationFrame(init);
      const { w, h } = computePageSize(r.width, r.height);
      if (!w || !h) return requestAnimationFrame(init);
      setBookSize({ w, h });
      const pageElements = pagesSrc.map(src => { const pageDiv = document.createElement('div'); pageDiv.className = 'page'; const img = document.createElement('img'); img.src = src; img.draggable = false; pageDiv.appendChild(img); return pageDiv; });
      pageFlipRef.current = new St.PageFlip(hostRef.current, { width: w, height: h, usePortrait: false, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.7, useMouseEvents: true });
      pageFlipRef.current.loadFromHTML(pageElements);
      pageFlipRef.current.on('changeState', (e) => {
        if (e.data === 'flipping') {
          setIsFlipping(true);
          const cp = pageFlipRef.current.getCurrentPageIndex();
          const soundUrl = (cp <= 1 || cp >= pageFlipRef.current.getPageCount() - 2) ? `${pathPrefix}cover.mp3` : `${pathPrefix}page-flip.mp3`;
          audioApiRef.current?.playOneShotSfx(soundUrl);
        }
      });
      pageFlipRef.current.on('flip', (e) => { setIsFlipping(false); onPageFlip(e.data); });
      hostRef.current.classList.add('frame');
      if (!cancelled) setReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, [pagesSrc, onPageFlip, pathPrefix]);
  
  useEffect(() => { function onResize() { if (!stageRef.current || !pageFlipRef.current) return; const rect = stageRef.current.getBoundingClientRect(); const { w, h } = computePageSize(rect.width, rect.height); if (w && h) { pageFlipRef.current.update({ width: w, height: h }); setBookSize({ w, h }); } } window.addEventListener('resize', onResize); const id = requestAnimationFrame(onResize); return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize); }; }, []);
  useEffect(() => { if (!hostRef.current || !pageFlipRef.current || !bookSize.w) return; const isClosedAtStart = currentPage === 0; const isClosedAtEnd = currentPage === pageFlipRef.current.getPageCount() - 1; const bookElement = hostRef.current; if (isClosedAtStart) { setIsBookPrepared(false); bookElement.style.transform = `translateX(-${bookSize.w / 2}px)`; } else if (isClosedAtEnd) { bookElement.style.transform = `translateX(${bookSize.w / 2}px)`; } else { setIsBookPrepared(true); bookElement.style.transform = 'translateX(0)'; } }, [currentPage, bookSize, ready]);
  const handlePrepareBook = (e, onComplete = null) => { e?.stopPropagation(); if (!isBookPrepared && hostRef.current && pageFlipRef.current) { const bookElement = hostRef.current; const onSlideComplete = () => { if (onComplete) { onComplete(); } else { pageFlipRef.current?.flipNext(); } }; bookElement.addEventListener('transitionend', onSlideComplete, { once: true }); setIsBookPrepared(true); bookElement.style.transform = 'translateX(0)'; } };
  const handleFlipNext = () => { if (isFlipping || !pageFlipRef.current) return; const totalPages = pageFlipRef.current.getPageCount(); if (currentPage === totalPages - 1) { pageFlipRef.current.flip(0); } else { pageFlipRef.current.flipNext(); } };
  const handleFlipPrev = () => { if (!isFlipping) pageFlipRef.current?.flipPrev(); };
  useEffect(() => { function onKey(e) { if (e.key === 'ArrowRight') { if (currentPage === 0 && !isBookPrepared) { handlePrepareBook(e); } else { handleFlipNext(); } } else if (e.key === 'ArrowLeft') { handleFlipPrev(); } } window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [isFlipping, currentPage, isBookPrepared]);
  const showInterceptor = currentPage === 0 && !isBookPrepared && ready;
  return (<main ref={stageRef} className="stage"><div className="book-wrapper">{showInterceptor && <div className="click-interceptor" onClick={handlePrepareBook} />}{showInterceptor && (<div className="open-book-indicator"><span className="chevron">&laquo;</span><span className="chevron">&laquo;</span><span className="chevron">&laquo;</span></div>)}<div id="book" ref={hostRef}></div></div></main>);
});


/* ========= APP PRINCIPAL ========= */
function App() {
  const PAGE_PAIRS = 25;
  const ASSETS_PATH = "assets/";
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [maxPageVisited, setMaxPageVisited] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isHidingLoader, setIsHidingLoader] = useState(false);
  const bookApiRef = useRef(null);
  const audioManagerRef = useRef(null);
  
  // Estado de silencio global y persistente
  const [isMuted, setIsMuted] = useState(() => JSON.parse(localStorage.getItem('comicMuted')) ?? false);
  useEffect(() => { localStorage.setItem('comicMuted', JSON.stringify(isMuted)); }, [isMuted]);
  const toggleMute = () => setIsMuted(prev => !prev);
  
  // Si es móvil, renderiza la advertencia y detiene la ejecución.
  if (isMobile) { return <MobileWarningScreen imagePath={`${ASSETS_PATH}mobile.webp`} />; }

  useEffect(() => { if (currentPage > maxPageVisited) { setMaxPageVisited(currentPage); } }, [currentPage, maxPageVisited]);
  
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
      const imagePromises = imageSources.map(src => new Promise((resolve) => { const img = new Image(); img.src = src; img.onload = () => { updateProgress(); resolve(); }; img.onerror = () => { updateProgress(); resolve(); }; }));
      const audioPromises = audioSources.map(src => new Promise((resolve) => { const audio = new Audio(); audio.src = src; const onAudioReady = () => { updateProgress(); resolve(); audio.removeEventListener('canplaythrough', onAudioReady); audio.removeEventListener('error', onAudioReady); }; audio.addEventListener('canplaythrough', onAudioReady); audio.addEventListener('error', onAudioReady); }));
      await Promise.all([...imagePromises, ...audioPromises]);
      setIsHidingLoader(true);
      setTimeout(() => { setIsLoading(false); }, 500);
    };
    preloadAssets();
  }, []);

  const handleNavigate = (pageNumber) => { bookApiRef.current?.flipToPage(pageNumber); };

  return (
    <>
      {isLoading && <LoadingScreen progress={loadingProgress} isHiding={isHidingLoader} />}
      <StageBackground backgroundMap={backgroundMap} defaultBackground={defaultBackground} currentPage={currentPage} />
      <FlipBook ref={bookApiRef} pagePairsCount={PAGE_PAIRS} pathPrefix={ASSETS_PATH} onPageFlip={setCurrentPage} currentPage={currentPage} audioApiRef={audioManagerRef} />
      <AudioManager ref={audioManagerRef} backgroundTrack={backgroundTrack} sfxMap={sfxMap} currentPage={currentPage} isMuted={isMuted} toggleMute={toggleMute} />
      <NavBar onNavigate={handleNavigate} maxPageVisited={maxPageVisited} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);