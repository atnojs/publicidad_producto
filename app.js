const { useState, useEffect, useRef } = React;

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

const STORAGE_KEY = 'creative_ads_engine_history';

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

    // Persistencia de historial
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setHistory(JSON.parse(saved));
        } catch (e) { console.error("Error cargando historial", e); }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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

    const generateAds = async () => {
        if (!imagePreview || !description) return alert("Por favor, sube una imagen y describe el producto.");

        setIsGenerating(true);
        setCurrentStep('processing');

        try {
            // Generamos dos propuestas (A y B)
            const proposals = ['Propuesta A', 'Propuesta B'].map(pLabel => ({
                label: pLabel,
                assets: AD_STYLES.map(style => ({
                    id: `${style.id}_${Math.random().toString(36).substr(2, 5)}`,
                    styleId: style.id,
                    label: style.label,
                    url: `https://picsum.photos/seed/${style.id}_${Math.random()}/800/1000`,
                    prompt: `${description}. ${style.promptSuffix}`,
                    videoUrl: null // Sin video inicial
                }))
            }));

            const fullBatch = {
                id: Date.now(),
                baseImage: imagePreview,
                timestamp: new Date().toLocaleString(),
                proposals: proposals
            };

            setResults(fullBatch);
            setActiveProposalIdx(0);
            setHistory(prev => [fullBatch, ...prev]);
            setCurrentStep('results');
        } catch (err) {
            console.error(err);
            alert("Error al generar los anuncios. Revisa la consola.");
            setCurrentStep('input');
        } finally {
            setIsGenerating(false);
        }
    };

    const regenerateAsset = (proposalIdx, assetIdx) => {
        const newResults = { ...results };
        const asset = newResults.proposals[proposalIdx].assets[assetIdx];

        // Simulación de regeneración
        asset.url = `https://picsum.photos/seed/${asset.styleId}_${Date.now()}_${Math.random()}/800/1000`;
        asset.videoUrl = null; // Reset video if regenerated

        setResults(newResults);
        // Actualizar historia (shallow copy might need deeper update in production)
        setHistory(prev => prev.map(item => item.id === results.id ? newResults : item));
    };

    const generateVideo = (proposalIdx, assetIdx) => {
        const newResults = { ...results };
        const asset = newResults.proposals[proposalIdx].assets[assetIdx];

        if (asset.videoUrl) return; // Ya tiene video

        // Simulación de generación de video
        asset.videoUrl = 'https://atnojs.es/recursos/demo-video-placeholder.mp4';

        setResults(newResults);
        setHistory(prev => prev.map(item => item.id === results.id ? newResults : item));
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
                                <p className="text-white/60 text-lg">Sube la foto base de tu producto y genera <span className="text-fuchsia-400 font-bold">2 propuestas</span> completas.</p>
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
                                        {isGenerating ? <i data-lucide="loader-2" className="animate-spin"></i> : <i data-lucide="sparkles"></i>}
                                        {isGenerating ? 'PROCESANDO...' : 'GENERAR 2 PROPUESTAS'}
                                    </button>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="glass p-4 rounded-xl flex items-center gap-3">
                                            <i data-lucide="image" className="text-cyan-400 w-5 h-5"></i>
                                            <span className="text-xs font-semibold">16 VARIACIONES (2 sets)</span>
                                        </div>
                                        <div className="glass p-4 rounded-xl flex items-center gap-3">
                                            <i data-lucide="video" className="text-fuchsia-400 w-5 h-5"></i>
                                            <span className="text-xs font-semibold">VIDEO BAJO DEMANDA</span>
                                        </div>
                                    </div>
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

                                {/* Tabs de Propuestas */}
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

                                <div className="flex gap-4">
                                    <button className="glass-white px-5 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-white/10" onClick={() => window.print()}>
                                        <i data-lucide="download-cloud" className="w-4 h-4"></i> Exportar
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {results.proposals[activeProposalIdx].assets.map((asset, index) => (
                                    <div key={asset.id} className="result-card group glass overflow-hidden rounded-2xl relative">
                                        {asset.videoUrl ? (
                                            <video src={asset.videoUrl} className="w-full aspect-[4/5] object-cover" muted autoPlay loop />
                                        ) : (
                                            <img src={asset.url} className="w-full aspect-[4/5] object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105" onClick={() => setLightboxItem(asset)} />
                                        )}

                                        {/* Overlay Controles */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-4 pointer-events-none">
                                            <div className="flex justify-between items-start pointer-events-auto">
                                                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[9px] font-bold text-white/80 border border-white/10 uppercase">
                                                    {asset.label}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => regenerateAsset(activeProposalIdx, index)}
                                                        className="w-8 h-8 rounded-full bg-indigo-600/80 hover:bg-indigo-500 pointer-events-auto flex items-center justify-center transition-all shadow-lg group/btn relative"
                                                    >
                                                        <i data-lucide="refresh-cw" className="w-4 h-4 text-white"></i>
                                                        <span className="tooltip">Regenerar</span>
                                                    </button>
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

                                        <div className="absolute top-2 left-2 pointer-events-none">
                                            {asset.videoUrl && (
                                                <div className="bg-fuchsia-500 px-2 py-0.5 rounded text-[8px] font-black text-white shadow-lg">VIDEO LISTO</div>
                                            )}
                                        </div>
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
