import React, { useState } from 'react';
import ModelViewer3D from './ModelViewer3D';
import { generateTrellisModel } from '../api/imageGeneration';

interface Asset {
  id: string;
  type: 'image' | 'model';
  url: string;
  thumbnail?: string;
  createdAt: number;
}

interface AssetPanelProps {
  assets: Asset[];
  onAddToScene?: (asset: Asset) => void;
  descriptionInput: string;
  onDescriptionChange: (value: string) => void;
  isGenerating: boolean;
  onSubmit?: () => void;
}

const AssetPanel: React.FC<AssetPanelProps> = ({ 
  assets, 
  onAddToScene, 
  descriptionInput, 
  onDescriptionChange, 
  onSubmit,
  isGenerating 
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [viewMode, setViewMode] = useState<'image' | 'cutout' | '3d'>('image');
  const [is3DGenerating, setIs3DGenerating] = useState(false);
  const [model3DUrl, setModel3DUrl] = useState<string | null>(null);
  const [model3DError, setModel3DError] = useState<string | null>(null);

  // Reset view mode and 3D state when selected asset changes
  React.useEffect(() => {
    if (selectedAsset) {
      setViewMode('image');
      setModel3DUrl(null);
      setModel3DError(null);
      setIs3DGenerating(false);
    }
    
    // Cleanup when modal closes (selectedAsset becomes null)
    return () => {
      if (!selectedAsset) {
        console.log('🧹 AssetPanel modal closed, cleaning up 3D state');
        setViewMode('image');
        setModel3DUrl(null);
        setModel3DError(null);
        setIs3DGenerating(false);
      }
    };
  }, [selectedAsset?.id]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-24 z-50 w-10 h-10 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center hover:bg-slate-800/90 transition-all"
      >
        <svg 
          className={`w-5 h-5 text-white transition-transform ${isOpen ? 'rotate-0' : 'rotate-180'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Asset Panel */}
      <div 
        className={`fixed left-0 top-0 h-full bg-slate-900/95 backdrop-blur-xl border-r border-white/10 transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '320px' }}
      >
        <div className="flex flex-col h-full p-4">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-white font-bold text-xl mb-1">Assets</h2>
            <p className="text-white/50 text-xs mb-3">{assets.length} item{assets.length !== 1 ? 's' : ''}</p>
            
            {/* Input Field */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Describe to generate..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSubmit?.();
                  }
                }}
                disabled={isGenerating}
                className="flex-1 bg-slate-800/60 backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg text-white/90 placeholder:text-white/40 text-xs focus:outline-none focus:border-white/30 focus:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50"
              />
              <button
                onClick={onSubmit}
                disabled={isGenerating}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50"
                aria-label="Submit"
              >
                {isGenerating ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Asset List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {/* Loading State */}
            {isGenerating && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
                <div className="w-full h-32 bg-slate-700/50 rounded-lg flex flex-col items-center justify-center">
                  <div className="relative w-12 h-12 mb-2">
                    <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-white/60 text-xs">Generating...</p>
                </div>
              </div>
            )}

            {assets.length === 0 && !isGenerating && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm">No assets yet</p>
                <p className="text-white/30 text-xs mt-1">Generate images and 3D models</p>
              </div>
            )}

            {assets.length > 0 && assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`group relative bg-slate-800/50 hover:bg-slate-800/80 rounded-lg p-3 cursor-pointer transition-all border ${
                    selectedAsset?.id === asset.id ? 'border-white/30' : 'border-white/10'
                  }`}
                >
                  {/* Asset Preview */}
                  <div className="w-full h-32 bg-slate-700/50 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                    {asset.type === 'image' ? (
                      <img src={asset.url} alt="Asset" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-12 h-12 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="text-white/40 text-xs mt-2">3D Model</span>
                      </div>
                    )}
                  </div>

                  {/* Asset Info */}
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-xs">
                      {asset.type === 'image' ? 'Image' : '3D Model'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToScene?.(asset);
                      }}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-all"
                    >
                      Add to Scene
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {selectedAsset && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={() => setSelectedAsset(null)}
        >
          <div 
            className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Preview Content */}
            <div className="w-full h-96 bg-slate-800/50 rounded-xl overflow-hidden flex items-center justify-center mb-4">
              {viewMode === '3d' && model3DUrl ? (
                <iframe
                  src={`/model-viewer.html?model=${encodeURIComponent(model3DUrl)}`}
                  className="w-full h-full border-0"
                  title="3D Model Viewer"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : viewMode === '3d' && is3DGenerating ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-white/60 text-sm">Generating 3D model...</p>
                </div>
              ) : viewMode === '3d' && model3DError ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="text-red-400 text-sm mb-2">⚠️ Error</div>
                  <p className="text-white/60 text-xs text-center px-4">{model3DError}</p>
                </div>
              ) : (
                <img 
                  src={selectedAsset.url} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain"
                  style={viewMode === 'cutout' ? { mixBlendMode: 'screen' } : {}}
                />
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex gap-3">
                {/* Toggle Options - Only show for image assets */}
                {selectedAsset.type === 'image' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('image')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        viewMode === 'image'
                          ? 'bg-white text-slate-900'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
                      }`}
                    >
                      Image
                    </button>
                    <button
                      onClick={() => setViewMode('cutout')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        viewMode === 'cutout'
                          ? 'bg-white text-slate-900'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
                      }`}
                    >
                      Cutout
                    </button>
                    <button
                      onClick={async () => {
                        setViewMode('3d');
                        if (!model3DUrl && !is3DGenerating) {
                          setIs3DGenerating(true);
                          setModel3DError(null);
                          try {
                            console.log('🎲 Starting 3D model generation for image:', selectedAsset.url);
                            const modelUrl = await generateTrellisModel(selectedAsset.url);
                            console.log('🎲 3D model generated successfully:', modelUrl);
                            setModel3DUrl(modelUrl);
                          } catch (error: any) {
                            console.error('❌ 3D model generation failed:', error);
                            setModel3DError(error.message || 'Failed to generate 3D model');
                          } finally {
                            setIs3DGenerating(false);
                          }
                        }
                      }}
                      disabled={is3DGenerating}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                        viewMode === '3d'
                          ? 'bg-white text-slate-900'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
                      }`}
                    >
                      {is3DGenerating ? 'Generating...' : 'Make 3D'}
                    </button>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    onAddToScene?.(selectedAsset);
                    setSelectedAsset(null);
                  }}
                  className="px-4 py-3 bg-white text-slate-900 hover:shadow-lg text-sm rounded-lg transition-all font-semibold"
                >
                  Add to Scene
                </button>
              </div>

              {/* Download/View buttons when 3D model is ready */}
              {viewMode === '3d' && model3DUrl && (
                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <a 
                    href={model3DUrl} 
                    download 
                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all border border-white/20 text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download GLB
                  </a>
                  <a 
                    href={model3DUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all border border-white/20 text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in New Tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AssetPanel;
