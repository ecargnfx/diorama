
import React from 'react';
import { DetectionSettings, Theme, ShapeType } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  settings: DetectionSettings;
  setSettings: React.Dispatch<React.SetStateAction<DetectionSettings>>;
  isCameraActive: boolean;
  onSummonBlessing: () => void;
  isSummoning: boolean;
  blessing: string | null;
  onClearBlessing: () => void;
  selectedShape: ShapeType;
  setSelectedShape: React.Dispatch<React.SetStateAction<ShapeType>>;
  onTakeScreenshot: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
}

const UIOverlay: React.FC<Props> = ({ 
    settings, setSettings, isCameraActive, 
    onSummonBlessing, isSummoning, blessing, onClearBlessing,
    selectedShape, setSelectedShape,
    onTakeScreenshot, onStartRecording, onStopRecording, isRecording
}) => {
  const [showSignUpModal, setShowSignUpModal] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [descriptionInput, setDescriptionInput] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleSubmitDescription = () => {
    if (isUnlocked) {
      // User is unlocked, generate image
      setIsGenerating(true);
      // TODO: Hook up API later
    } else {
      // Show sign-up modal
      setShowSignUpModal(true);
      setSubmitError(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await supabase
        .from('unlock3D')
        .insert([{ email: email }]);

      if (error) throw error;

      // Show success state
      setIsUnlocked(true);
      setEmail('');
    } catch (error: any) {
      console.error('Error saving email:', error);
      setSubmitError(error.message || 'Failed to sign up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const themes: { id: Theme; label: string; color: string }[] = [
    { id: 'midnight', label: 'Midnight', color: 'bg-blue-600' },
    { id: 'solstice', label: 'Solstice', color: 'bg-orange-400' },
    { id: 'aurora', label: 'Aurora', color: 'bg-emerald-500' }
  ];

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between p-8 md:p-12 overflow-hidden">
      <div className="flex flex-row items-start justify-between w-full">
        <div className="flex flex-col items-center md:items-start space-y-2">
          <div className="pointer-events-auto">
            <h1 className="text-4xl md:text-5xl font-light serif-font italic tracking-wide text-white drop-shadow-2xl">
              Let it Snow
            </h1>
            <div className="h-px w-32 bg-gradient-to-r from-white/80 to-transparent mt-2 mx-auto md:mx-0" />
            <p className="text-[10px] text-white/50 font-semibold mt-6 tracking-[0.4em] uppercase">
              Let's build a snowman!
            </p>
            <p className="text-[9px] text-white/40 tracking-widest leading-relaxed uppercase">
              Move one hand to position. <br/> Use two hands or two fingers to scale. <br/> Release to set in the scene. <br/> <i>Shine a light to make it snow</i>
            </p>          
          </div>
        </div>
        
        <div className="pointer-events-auto flex items-center gap-3">
          <button
              onClick={onTakeScreenshot}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
              aria-label="Take Screenshot"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-xs text-white/80">Screenshot</span>
          </button>
          <button
              onClick={isRecording ? onStopRecording : onStartRecording}
              className={`backdrop-blur-md border px-4 py-2 rounded-full flex items-center gap-2 transition-all active:scale-95 ${
                  isRecording 
                      ? 'bg-red-500/20 border-red-500/40 hover:bg-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                      : 'bg-white/10 border-white/20 hover:bg-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]'
              }`}
              aria-label={isRecording ? "Stop Recording" : "Start Recording"}
          >
              {isRecording ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
              ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                      <circle cx="12" cy="12" r="10"/>
                  </svg>
              )}
              <span className={`text-xs ${
                  isRecording ? 'text-red-400' : 'text-white/80'
              }`}>{isRecording ? 'Stop' : 'Record'}</span>
          </button>
        </div>
      </div>

      {blessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-3xl border border-white/10 p-12 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.6)] max-w-lg mx-6 text-center animate-in fade-in zoom-in duration-500">
            <h3 className="serif-font italic text-white/30 text-xs mb-8 tracking-widest uppercase">The Oracle Whispers...</h3>
            <p className="text-xl md:text-2xl text-white/90 serif-font font-light italic leading-relaxed">
              "{blessing}"
            </p>
            <button 
              onClick={onClearBlessing}
              className="mt-12 px-10 py-4 rounded-full bg-white/5 border border-white/20 hover:bg-white/10 text-[10px] uppercase tracking-[0.3em] text-white transition-all font-semibold"
            >
              Continue Synthesizing
            </button>
          </div>
        </div>
      )}

      {showSignUpModal && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-3xl border border-white/10 p-12 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.6)] max-w-md mx-6 text-center animate-in fade-in zoom-in duration-500 relative">
            <button
              onClick={() => setShowSignUpModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-all"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
            {!isUnlocked ? (
              <>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Sign Up</h2>
                <p className="text-sm text-white/50 mb-8">to access this feature</p>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-slate-800/60 backdrop-blur-md border border-white/20 px-6 py-4 pr-14 rounded-full text-white/90 placeholder:text-white/40 text-sm focus:outline-none focus:border-white/40 focus:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white hover:bg-white/90 flex items-center justify-center transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Submit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-950">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                </button>
              </div>
                  {submitError && (
                    <p className="text-red-400 text-xs text-center">{submitError}</p>
                  )}
                </form>
              </>
            ) : (
              <div className="py-8">
                <h2 className="text-6xl md:text-7xl font-bold text-white mb-4">Unlocked</h2>
                <p className="text-sm text-white/60">You can now generate images!</p>
                <button
                  onClick={() => setShowSignUpModal(false)}
                  className="mt-8 px-10 py-4 rounded-full bg-white text-slate-950 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] text-sm transition-all font-bold"
                >
                  Start Creating
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
        {/* <div className="pointer-events-auto w-full md:w-auto">
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 p-8 rounded-[2rem] w-full md:w-[440px] shadow-2xl space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">Cosmic Aesthetic</h2>
                <div className="flex gap-3">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setSettings(s => ({ ...s, theme: t.id }))}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${t.color} ${settings.theme === t.id ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-transparent opacity-40 hover:opacity-100'}`}
                        />
                    ))}
                </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                  <button 
                    onClick={onSummonBlessing}
                    disabled={isSummoning}
                    className="flex-1 group relative overflow-hidden bg-white text-slate-950 px-6 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_20px_white] active:scale-95 disabled:opacity-50"
                  >
                    <span className="relative z-10 serif-font italic capitalize text-lg tracking-normal">{isSummoning ? 'Consulting Stars...' : 'Synthesize Blessing'}</span>
                  </button>
              </div>
            </div>
          </div>
        </div> */}

        <div className="pointer-events-auto flex flex-col items-start gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
                <button
                    onClick={() => setSelectedShape('sphere')}
                    className={`w-8 h-8 rounded-full transition-all ${selectedShape === 'sphere' ? 'bg-blue-500 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-blue-500/40 hover:bg-blue-500/60'}`}
                    aria-label="Blue Sphere"
                />
                <button
                    onClick={() => setSelectedShape('cone')}
                    className={`w-8 h-8 transition-all ${selectedShape === 'cone' ? 'scale-110 shadow-[0_0_15px_rgba(255,136,0,0.6)]' : 'hover:opacity-80'}`}
                    aria-label="Orange Cone"
                    style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', backgroundColor: selectedShape === 'cone' ? '#ff8800' : 'rgba(255, 136, 0, 0.4)' }}
                />
                <button
                    onClick={() => setSelectedShape('brownSphere')}
                    className={`w-8 h-8 rounded-full transition-all ${selectedShape === 'brownSphere' ? 'bg-amber-800 scale-110 shadow-[0_0_15px_rgba(146,64,14,0.8)] ring-2 ring-white/30' : 'bg-amber-800/40 hover:bg-amber-800/60'}`}
                    aria-label="Brown Sphere"
                />
                <button
                    onClick={() => setSelectedShape('none')}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedShape === 'none' ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'border-white/40 hover:border-white/60'}`}
                    aria-label="No Shape"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mx-auto ${selectedShape === 'none' ? 'opacity-80' : 'opacity-40'}`}>
                        <path d="M12 3l1.912 5.813 6.088.281-4.781 3.656 1.781 5.75L12 15l-5 3.5 1.781-5.75-4.781-3.656 6.088-.281L12 3z"/>
                    </svg>
                </button>
            </div>
            <div className="flex items-center gap-3 w-full">
                <input
                    type="text"
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="Describe something to add to scene"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitDescription();
                      }
                    }}
                    className="bg-slate-900/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full text-white/90 placeholder:text-white/40 text-sm focus:outline-none focus:border-white/30 focus:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all w-full md:w-[400px]"
                />
                <button
                    onClick={handleSubmitDescription}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 w-11 h-11 rounded-full flex items-center justify-center transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
                    aria-label="Submit"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                        <path d="M5 12h14"/>
                        <path d="m12 5 7 7-7 7"/>
                    </svg>
                </button>
            </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)] z-10" />
      
      {isGenerating && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="w-64 h-64 bg-slate-900/90 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-white/80 text-sm font-medium">Generating...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
