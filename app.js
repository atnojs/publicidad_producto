const { useState, useEffect, useRef, useCallback } = React;

// Configuración de estilos para la IA
const AD_STYLES = [
    { id: 'estudio', label: 'Foto de Estudio', icon: 'camera', promptSuffix: "fotografía profesional de producto en estudio, fondo neutro limpio, iluminación suave, resolución 8k" },
    { id: 'estilo-de-vida', label: 'Estilo de Vida', icon: 'home', promptSuffix: "fotografía de estilo de vida, producto en un entorno hogareño natural, iluminación cálida, atmósfera acogedora" },
    { id: 'ugc', label: 'Estilo UGC', icon: 'smartphone', promptSuffix: "foto estilo contenido generado por el usuario, ligeramente imperfecta, iluminación realista, como si fuera tomada con un smartphone de alta gama" },
    { id: 'detalle', label: 'Enfoque en Detalle', icon: 'search', promptSuffix: "primer plano extremo macro, enfocado en la textura y calidad del material, profundidad de campo reducida" },
    { id: 'plano-cenital', label: 'Plano Cenital', icon: 'layout', promptSuffix: "fotografía flat lay desde arriba, disposición estética con accesorios a juego, composición organizada" },
    { id: 'con-modelo', label: 'Con Modelo', icon: 'user', promptSuffix: "persona interactuando con el producto de forma natural, enfoque en el producto, fondo humano desenfocado" },
    { id: 'cinematografico', label: 'Cinematográfico', icon: 'clapperboard', promptSuffix: "toma comercial cinematográfica de producto, iluminación dramática, alto contraste, destello de lente anamórfico" },
    { id: 'empaque', label: 'Empaque Premium', icon: 'package', promptSuffix: "producto exhibido con su empaque premium, sensación de experiencia unboxing, presentación de lujo" }
];

const DB_NAME = 'creative_ads_engine_db';
const DB_STORE = 'history';
const DB_VERSION = 1;

// ─── IndexedDB Helpers ───────────────────────────────────────
function openDB() {
    return new Promise(function (resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
                db.createObjectStore(DB_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
    });
}

function loadHistoryFromDB() {
    return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(DB_STORE, 'readonly');
            var store = tx.objectStore(DB_STORE);
            var req = store.getAll();
            req.onsuccess = function () {
                var items = req.result || [];
                items.sort(function (a, b) { return b.id - a.id; });
                resolve(items);
            };
            req.onerror = function () { reject(req.error); };
        });
    }).catch(function (e) {
        console.warn('Error cargando historial de IndexedDB:', e);
        return [];
    });
}

function saveHistoryToDB(historyArray) {
    // Limpiar blob URLs antes de guardar (no son persistentes)
    var cleanArray = JSON.parse(JSON.stringify(historyArray, function (key, value) {
        if (key === 'videoUrl' && typeof value === 'string' && value.startsWith('blob:')) {
            return null;
        }
        return value;
    }));
    return openDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(DB_STORE, 'readwrite');
            var store = tx.objectStore(DB_STORE);
            store.clear();
            cleanArray.forEach(function (item) { store.put(item); });
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    }).catch(function (e) {
        console.warn('Error guardando historial en IndexedDB:', e);
    });
}

// ─── Download Helper (blob pattern, funciona en todos los navegadores) ───
function downloadAsset(asset) {
    var fileName = 'creative_engine_' + asset.label.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();

    if (asset.videoUrl) {
        // Video blob URL → fetch como blob → descargar
        fetch(asset.videoUrl)
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName + '.mp4';
                document.body.appendChild(a);
                a.click();
                setTimeout(function () {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            })
            .catch(function (err) {
                console.error('Error descargando video:', err);
                alert('No se pudo descargar el vídeo.');
            });
        return;
    }

    if (asset.url) {
        // Imagen base64 → convertir a blob → descargar
        fetch(asset.url)
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName + '.png';
                document.body.appendChild(a);
                a.click();
                setTimeout(function () {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            })
            .catch(function (err) {
                console.error('Error descargando imagen:', err);
                alert('No se pudo descargar la imagen.');
            });
    }
}

// ─── Veo Video Generator (IA real) ──────────────────────────
function generateVideoWithVeo(imageDataUrl, prompt, onStatus) {
    var parts = imageDataUrl.split(',');
    var meta = parts[0];
    var base64Data = parts[1];
    var mimeType = meta.split(':')[1].split(';')[0];

    if (onStatus) onStatus('Enviando imagen a Veo...');

    return fetch('proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'generate_video',
            model: 'veo-3.1-generate-preview',
            prompt: prompt,
            base64ImageData: base64Data,
            mimeType: mimeType,
            aspectRatio: '9:16'
        })
    })
        .then(function (res) {
            if (!res.ok) {
                return res.text().then(function (text) {
                    var errMsg = 'Error HTTP ' + res.status;
                    try {
                        var d = JSON.parse(text);
                        if (d.error) {
                            errMsg = typeof d.error === 'object' ? JSON.stringify(d.error) : d.error;
                        }
                    } catch (e) {
                        errMsg = text || errMsg;
                    }
                    throw new Error(errMsg);
                });
            }
            return res.json();
        })
        .then(function (data) {
            var opName = data.name;
            if (!opName) throw new Error('No se recibió operationName. Respuesta: ' + JSON.stringify(data));
            if (onStatus) onStatus('Vídeo en cola de generación...');

            var maxAttempts = 36;
            var attempt = 0;

            function pollOperation() {
                attempt++;
                if (attempt > maxAttempts) throw new Error('Timeout: el vídeo tardó demasiado.');

                return new Promise(function (resolve) {
                    setTimeout(resolve, 5000);
                }).then(function () {
                    if (onStatus) onStatus('Generando vídeo con IA... (' + (attempt * 5) + 's)');
                    return fetch('proxy.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'poll_video', operationName: opName })
                    });
                }).then(function (res) {
                    return res.json();
                }).then(function (status) {
                    if (status.done === true) {
                        var videoUri = null;
                        try { videoUri = status.response.generateVideoResponse.generatedSamples[0].video.uri; } catch (e) { }
                        if (!videoUri) throw new Error('Vídeo generado pero sin URI.');
                        return videoUri;
                    }
                    if (status.error) {
                        throw new Error('Error de Veo: ' + (status.error.message || JSON.stringify(status.error)));
                    }
                    return pollOperation();
                });
            }

            return pollOperation();
        })
        .then(function (videoUri) {
            if (onStatus) onStatus('Descargando vídeo...');

            return fetch('proxy.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'download_video', videoUri: videoUri })
            });
        })
        .then(function (res) {
            if (!res.ok) throw new Error('Error descargando vídeo: HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            if (!data.videoBase64) throw new Error('No se recibió el vídeo en base64.');
            var binary = atob(data.videoBase64);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var blob = new Blob([bytes], { type: data.mimeType || 'video/mp4' });
            return URL.createObjectURL(blob);
        });
}

function App() {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [history, setHistory] = useState([]);
    const [results, setResults] = useState(null);
    const [activeProposalIdx, setActiveProposalIdx] = useState(0);
    const [lightboxItem, setLightboxItem] = useState(null);
    const [currentStep, setCurrentStep] = useState('input'); // input | processing | results

    // Persistencia de historial con IndexedDB (sin límite de 5MB)
    const historyLoaded = useRef(false);
    const saveTimerRef = useRef(null);

    useEffect(() => {
        loadHistoryFromDB().then(function (saved) {
            if (saved && saved.length > 0) setHistory(saved);
            historyLoaded.current = true;
        });
    }, []);

    useEffect(() => {
        if (!historyLoaded.current) return;
        // Debounce: guardar 500ms después del último cambio
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(function () {
            saveHistoryToDB(history);
        }, 500);
    }, [history]);

    // Refrescar iconos Lucide
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [currentStep, results, history, lightboxItem, activeProposalIdx]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const callGeminiImage = async (prompt, base64Image) => {
        try {
            const response = await fetch('proxy.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_image',
                    model: 'gemini-3.1-flash-image-preview',
                    prompt: prompt,
                    base64ImageData: base64Image.split(',')[1],
                    mimeType: base64Image.split(';')[0].split(':')[1]
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            // El modelo gemini-3.1-flash-image-preview devuelve la imagen en candidates[0].content.parts
            // Buscamos la part que tenga inlineData
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart) {
                return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            }
            throw new Error("No se recibió imagen de la IA");
        } catch (err) {
            console.error("Error en callGeminiImage:", err);
            return null;
        }
    };

    const generateAds = async () => {
        if (!imagePreview || !description) return alert("Por favor, sube una imagen y describe el producto.");

        setIsGenerating(true);
        setCurrentStep('processing');

        try {
            // Inicializar estructura vacía para que el usuario vea el contenedor (Solo 1 Propuesta ahora)
            const emptyProposals = ['Propuesta Única'].map(pLabel => ({
                label: pLabel,
                assets: AD_STYLES.map(style => ({
                    id: `${style.id}_${Math.random().toString(36).substr(2, 5)}`,
                    styleId: style.id,
                    label: style.label,
                    url: null,
                    prompt: `${description}. ${style.promptSuffix}`,
                    videoUrl: null,
                    loading: true
                }))
            }));

            const batchId = Date.now();
            const fullBatch = {
                id: batchId,
                baseImage: imagePreview,
                timestamp: new Date().toLocaleString(),
                proposals: emptyProposals
            };

            setResults(fullBatch);
            setCurrentStep('results');
            setActiveProposalIdx(0);

            // Generar imágenes progresivamente para la propuesta única
            for (let i = 0; i < AD_STYLES.length; i++) {
                const style = AD_STYLES[i];
                const prompt = `${description}. ${style.promptSuffix}`;

                // Llamada real a la API
                const imageUrl = await callGeminiImage(prompt, imagePreview);

                setResults(prev => {
                    const updated = JSON.parse(JSON.stringify(prev)); // Deep copy para forzar re-render
                    updated.proposals[0].assets[i].url = imageUrl || 'https://via.placeholder.com/800x1000?text=Error+al+generar';
                    updated.proposals[0].assets[i].loading = false;
                    return updated;
                });
            }

            // Actualizar historial al finalizar todo usando el objeto FINAL
            setResults(finalBatch => {
                setHistory(prev => [finalBatch, ...prev]);
                return finalBatch;
            });

        } catch (err) {
            console.error(err);
            alert("Error general al generar los anuncios.");
            setCurrentStep('input');
        } finally {
            setIsGenerating(false);
        }
    };

    const regenerateAsset = async (proposalIdx, assetIdx) => {
        const newResults = { ...results };
        const asset = newResults.proposals[proposalIdx].assets[assetIdx];

        asset.loading = true;
        asset.url = null;
        setResults({ ...newResults });

        const newUrl = await callGeminiImage(asset.prompt, results.baseImage);

        asset.url = newUrl || 'https://via.placeholder.com/800x1000?text=Error+al+generar';
        asset.loading = false;
        asset.videoUrl = null;

        setResults({ ...newResults });
        setHistory(prev => prev.map(item => item.id === results.id ? newResults : item));
    };

    const [videoStatus, setVideoStatus] = useState('');

    const generateVideo = async (proposalIdx, assetIdx) => {
        const currentAsset = results.proposals[proposalIdx].assets[assetIdx];
        if (!currentAsset.url) return alert('No hay imagen para generar vídeo.');

        const newVideoId = `vid_${Date.now()}`;

        // Añadimos tarjeta en estado "cargando"
        setResults(prev => {
            const updated = JSON.parse(JSON.stringify(prev));
            updated.proposals[proposalIdx].assets.push({
                id: newVideoId,
                styleId: currentAsset.styleId,
                label: `VIDEO: ${currentAsset.label}`,
                url: currentAsset.url,
                prompt: currentAsset.prompt,
                videoUrl: null,
                loading: true
            });
            return updated;
        });

        try {
            const videoPrompt = 'Smooth cinematic product video, subtle motion, professional lighting, slow elegant movement, commercial quality. ' + (currentAsset.prompt || '');

            const videoUrl = await generateVideoWithVeo(
                currentAsset.url,
                videoPrompt,
                function (status) { setVideoStatus(status); }
            );

            setResults(prev => {
                const updated = JSON.parse(JSON.stringify(prev));
                const vIdx = updated.proposals[proposalIdx].assets.findIndex(a => a.id === newVideoId);
                if (vIdx !== -1) {
                    updated.proposals[proposalIdx].assets[vIdx].videoUrl = videoUrl;
                    updated.proposals[proposalIdx].assets[vIdx].loading = false;
                }
                setHistory(prevHist => prevHist.map(item => item.id === updated.id ? updated : item));
                return updated;
            });
            setVideoStatus('');
        } catch (err) {
            console.error('Error generando vídeo:', err);
            setResults(prev => {
                const updated = JSON.parse(JSON.stringify(prev));
                updated.proposals[proposalIdx].assets = updated.proposals[proposalIdx].assets.filter(a => a.id !== newVideoId);
                return updated;
            });
            setVideoStatus('');
            alert('Error generando vídeo: ' + err.message);
        }
    };

    const deleteHistoryItem = (id) => {
        if (confirm("¿Eliminar este lote de anuncios?")) {
            setHistory(prev => prev.filter(item => item.id !== id));
            if (results && results.id === id) {
                setResults(null);
                setCurrentStep('input');
            }
        }
    };

    return (
        <div className="app-container">
            {/* Overlay de Carga Stándard */}
            {isGenerating && (
                <div className="loading-overlay">
                    <div className="spinner-triple">
                        <div className="ring ring-1"></div>
                        <div className="ring ring-2"></div>
                        <div className="ring ring-3"></div>
                    </div>
                    <p className="loading-text">IA CREANDO TUS PROPUESTAS MAESTRAS...</p>
                </div>
            )}

            {/* Sidebar Historial */}
            <aside className="sidebar glass border-r border-white/10">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
                        <i data-lucide="history"></i> Historial
                    </h2>
                    <div className="space-y-4 history-list overflow-y-auto max-h-[80vh]">
                        {history.length === 0 && <p className="text-white/40 italic">Sin campañas generadas</p>}
                        {history.map(item => (
                            <div key={item.id} className={`history-card glass-hover p-3 rounded-lg cursor-pointer group ${results && results.id === item.id ? 'active-history' : ''}`} onClick={() => { setResults(item); setCurrentStep('results'); setActiveProposalIdx(0); }}>
                                <div className="flex gap-3 items-center">
                                    <img src={item.baseImage} className="w-12 h-12 rounded object-cover border border-white/20" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs text-white/60">{item.timestamp}</p>
                                        <p className="text-sm font-medium truncate">Campaña #{item.id.toString().slice(-4)}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }} className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-500/20 rounded-full transition-all">
                                        <i data-lucide="trash-2" className="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="flex justify-between items-center mb-10 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                            <i data-lucide="zap" className="text-white"></i>
                        </div>
                        <h1 className="text-2xl font-black tracking-tighter text-white">
                            CREATIVE <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">ENGINE</span>
                        </h1>
                    </div>
                    <button className="glass-white px-4 py-2 rounded-full flex items-center gap-2 text-sm hover:bg-white/10 transition-all font-medium">
                        <i data-lucide="external-link" className="w-4 h-4"></i> Tutorial
                    </button>
                </header>

                <div className="content-inner px-8">
                    {currentStep === 'input' && (
                        <div className="max-w-4xl mx-auto py-10 fade-in">
                            <div className="text-center mb-12">
                                <h2 className="text-4xl font-bold mb-4">Transforma una foto en <span className="text-cyan-400">Todo tu Marketing</span></h2>
                                <p className="text-white/60 text-lg">Sube la foto base de tu producto y genera una <span className="text-fuchsia-400 font-bold">Propuesta Maestra</span>.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* Upload Zone */}
                                <div className="upload-container">
                                    <label className="upload-card glass border-2 border-dashed border-white/20 hover:border-cyan-400/50 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[400px] rounded-2xl relative overflow-hidden group">
                                        {imagePreview ? (
                                            <div className="w-full h-full absolute inset-0">
                                                <img src={imagePreview} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                                    <span className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold">CAMBIAR IMAGEN</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-full bg-cyan-400/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-all">
                                                    <i data-lucide="upload" className="text-cyan-400 w-8 h-8"></i>
                                                </div>
                                                <p className="text-lg font-medium">Sube tu producto</p>
                                                <p className="text-white/40 text-sm">JPG, PNG o WEBP (máx 5MB)</p>
                                            </>
                                        )}
                                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                    </label>
                                </div>

                                {/* Form Zone */}
                                <div className="flex flex-col justify-center space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold text-cyan-400 uppercase tracking-widest pl-1">Descripción del Producto</label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Ej: Elegante reloj de cuero negro con esfera plateada, estilo minimalista..."
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[150px] focus:outline-none focus:border-cyan-400/50 transition-all text-white placeholder:text-white/20"
                                        />
                                    </div>

                                    <button
                                        onClick={generateAds}
                                        disabled={isGenerating || !imagePreview || !description}
                                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-lg flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? <i data-lucide="loader-2" className="animate-spin text-white"></i> : <i data-lucide="sparkles" className="text-white"></i>}
                                        <span className="text-white">{isGenerating ? 'PROCESANDO...' : 'GENERAR PROPUESTA MAESTRA'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 'results' && results && (
                        <div className="py-6 fade-in">
                            <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
                                <div>
                                    <button onClick={() => setCurrentStep('input')} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2 mb-2 transition-all font-medium">
                                        <i data-lucide="arrow-left" className="w-4 h-4"></i> Volver a Crear
                                    </button>
                                    <h2 className="text-2xl font-bold font-montserrat">Resultados de Campaña</h2>
                                    <p className="text-white/50 text-sm">Lote: {results.timestamp}</p>
                                </div>

                                {/* Tabs de Propuestas - Solo si hay más de una */}
                                {results.proposals.length > 1 && (
                                    <div className="flex glass p-1 rounded-xl">
                                        {results.proposals.map((prop, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setActiveProposalIdx(idx)}
                                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeProposalIdx === idx ? 'bg-cyan-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                                            >
                                                {prop.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <button className="glass-white px-5 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-white/10" onClick={() => {
                                        const assets = results.proposals[activeProposalIdx].assets.filter(a => !a.loading && (a.url || a.videoUrl));
                                        assets.forEach((asset, i) => setTimeout(() => downloadAsset(asset), i * 300));
                                    }}>
                                        <i data-lucide="download-cloud" className="w-4 h-4"></i> Exportar Todo
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {results.proposals[activeProposalIdx].assets.map((asset, index) => (
                                    <div key={asset.id} className="result-card group glass overflow-hidden rounded-2xl relative min-h-[300px] flex items-center justify-center bg-white/5">
                                        {asset.loading ? (
                                            <div className="flex flex-col items-center gap-3 p-4">
                                                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="text-[10px] text-cyan-400 font-bold animate-pulse text-center">{(asset.label && asset.label.startsWith('VIDEO') && videoStatus) ? videoStatus : 'GENERANDO...'}</span>
                                            </div>
                                        ) : asset.videoUrl ? (
                                            <video src={asset.videoUrl} className="w-full aspect-[4/5] object-cover" muted autoPlay loop />
                                        ) : (
                                            <img src={asset.url} className="w-full aspect-[4/5] object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105" onClick={() => setLightboxItem(asset)} />
                                        )}

                                        {/* Overlay Controles */}
                                        {!asset.loading && (
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-4 pointer-events-none">
                                                <div className="flex justify-between items-start pointer-events-auto">
                                                    <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[9px] font-bold text-white/80 border border-white/10 uppercase">
                                                        {asset.label}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {!asset.videoUrl && (
                                                            <button
                                                                onClick={() => regenerateAsset(activeProposalIdx, index)}
                                                                className="w-8 h-8 rounded-full bg-indigo-600/80 hover:bg-indigo-500 pointer-events-auto flex items-center justify-center transition-all shadow-lg group/btn relative"
                                                            >
                                                                <i data-lucide="refresh-cw" className="w-4 h-4 text-white"></i>
                                                                <span className="tooltip">Regenerar</span>
                                                            </button>
                                                        )}
                                                        {!asset.videoUrl ? (
                                                            <button
                                                                onClick={() => generateVideo(activeProposalIdx, index)}
                                                                className="w-8 h-8 rounded-full bg-fuchsia-600/80 hover:bg-fuchsia-500 pointer-events-auto flex items-center justify-center transition-all shadow-lg group/btn relative"
                                                            >
                                                                <i data-lucide="video" className="w-4 h-4 text-white"></i>
                                                                <span className="tooltip">Generar Video</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setLightboxItem(asset)}
                                                                className="w-8 h-8 rounded-full bg-fuchsia-600/80 hover:bg-fuchsia-500 pointer-events-auto flex items-center justify-center transition-all shadow-lg group/btn relative"
                                                            >
                                                                <i data-lucide="maximize" className="w-4 h-4 text-white"></i>
                                                                <span className="tooltip">Ver Video</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => downloadAsset(asset)}
                                                            className="w-8 h-8 rounded-full bg-cyan-600/80 hover:bg-cyan-500 pointer-events-auto flex items-center justify-center transition-all shadow-lg group/btn relative"
                                                        >
                                                            <i data-lucide="download" className="w-4 h-4 text-white"></i>
                                                            <span className="tooltip">Descargar</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end pointer-events-auto">
                                                    {/* Espacio reservado para acciones inferiores si fueran necesarias */}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Lightbox Simplificado: Imagen o Video */}
            {lightboxItem && (
                <div className="lightbox cursor-zoom-out" onClick={() => setLightboxItem(null)}>
                    <div className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        {lightboxItem.videoUrl ? (
                            <video
                                src={lightboxItem.videoUrl}
                                className="max-h-[85vh] w-auto rounded-lg shadow-2xl border border-white/10"
                                controls
                                autoPlay
                            />
                        ) : (
                            <img
                                src={lightboxItem.url}
                                className="max-h-[85vh] w-auto rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/5"
                                onClick={() => setLightboxItem(null)}
                            />
                        )}
                        <button
                            className="absolute -top-12 right-0 text-white/60 hover:text-white transition-all p-2"
                            onClick={() => setLightboxItem(null)}
                        >
                            <i data-lucide="x" className="w-8 h-8"></i>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
