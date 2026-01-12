
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DetectionSettings, Point, HandData, Orb, ShapeType, FistState, HandState } from './types';
import LightDetector from './components/LightDetector';
import HandTracker from './components/HandTracker';
import Scene3D from './components/Scene3D';
import SnowOverlay from './components/SnowOverlay';
import UIOverlay from './components/UIOverlay';
import AssetPanel from './components/AssetPanel';
import HandGestureDetector from './components/HandGestureDetector';
import PowGraphic from './components/PowGraphic';
import HiGraphic from './components/HiGraphic';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';

interface Asset {
  id: string;
  type: 'image' | 'model';
  url: string;
  thumbnail?: string;
  createdAt: number;
}

const App: React.FC = () => {
  const [settings, setSettings] = useState<DetectionSettings>({
    threshold: 240, 
    sensitivity: 0.6,
    particleCount: 1500,
    gravity: 0.03,
    theme: 'midnight',
    filterMode: 'mystical'
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeEmitters, setActiveEmitters] = useState<Point[]>([]);
  const [hands, setHands] = useState<HandData[]>([
    { x: 0, y: 0, z: 0, isDetected: false, fingersExtended: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
    { x: 0, y: 0, z: 0, isDetected: false, fingersExtended: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
  ]);
  const [placedOrbs, setPlacedOrbs] = useState<Orb[]>([]);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('cone');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const submitHandlerRef = useRef<(() => void) | null>(null);
  const [loadedModels, setLoadedModels] = useState<Array<{ id: string; url: string; position?: { x: number; y: number; z: number }; scale?: number; rotation?: { x: number; y: number; z: number } }>>([]);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [blessing, setBlessing] = useState<string | null>(null);
  const [isSummoning, setIsSummoning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [fistState, setFistState] = useState<FistState>({ detected: false, x: 0, y: 0, lastSeen: 0 });
  const [handState, setHandState] = useState<HandState>({ detected: false, x: 0, y: 0, lastSeen: 0 });
  
  // Ref to track if we've already placed an orb for the current gesture to prevent multi-firing
  const isPlacingRef = useRef(false);
  const rotationZRef = useRef(0);
  const lastRadiusRef = useRef(0.5);
  const holdPositionRef = useRef<{ x: number; y: number; z: number; startTime: number } | null>(null);
  
  // Refs to track initial hand rotation when model3D mode starts
  const initialHandRotationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const model3DModeActiveRef = useRef(false);

  // Calculate current orb position using useMemo to prevent unnecessary re-renders
  const currentOrb = useMemo(() => {
    const hand1 = hands[0];
    const hand2 = hands[1];

    if (!hand1.isDetected || selectedShape === 'none' || selectedShape === 'model3D') return null;

    let targetX = hand1.x;
    let targetY = hand1.y;
    let targetZ = hand1.z;
    let radius = 0.5;

    if (hand2.isDetected) {
      targetX = (hand1.x + hand2.x) / 2;
      targetY = (hand1.y + hand2.y) / 2;
      targetZ = (hand1.z + hand2.z) / 2;

      const dist = Math.sqrt(
        Math.pow(hand1.x - hand2.x, 2) + 
        Math.pow(hand1.y - hand2.y, 2) +
        Math.pow(hand1.z - hand2.z, 2)
      );
      radius = Math.max(0.1, dist * 2.5);
      lastRadiusRef.current = radius;
      
      // Rotation logic for two hands: left hand above right hand = counter-clockwise
      // right hand above left hand = clockwise (only affects Z rotation)
      const yDiff = hand1.y - hand2.y;
      if (Math.abs(yDiff) > 0.05) { // Threshold to avoid jitter
        if (yDiff < 0) {
          // Left hand is above right hand (lower y value) - rotate counter-clockwise
          rotationZRef.current -= 0.05;
        } else {
          // Right hand is above left hand - rotate clockwise
          rotationZRef.current += 0.05;
        }
      }
    } else {
      // Single hand: scale radius based on fingers extended (1-5 fingers -> 0.1-0.5 radius)
      radius = Math.max(0.1, (hand1.fingersExtended / 5) * 0.5);
      lastRadiusRef.current = radius;
    }

    const color = selectedShape === 'cone' ? '#ff8800' : 
                  (settings.theme === 'solstice' ? '#ffcc33' : (settings.theme === 'aurora' ? '#4ade80' : '#b0e0ff'));

    // Use hand rotation for single hand, or rotationZRef for two hands
    let rotX = 0, rotY = 0, rotZ = 0;
    if (hand2.isDetected) {
      rotZ = rotationZRef.current;
    } else {
      rotX = hand1.rotationX;
      rotY = hand1.rotationY;
      rotZ = hand1.rotationZ;
    }

    return {
      id: 'active',
      x: (0.5 - targetX) * 10,
      y: (0.5 - targetY) * 8,
      z: (targetZ * -15),
      radius,
      color,
      shape: selectedShape,
      rotationX: rotX,
      rotationY: rotY,
      rotationZ: rotZ
    };
  }, [hands, settings.theme, selectedShape]);

  // Calculate hand position for controlling 3D models when model3D mode is selected
  const modelControlPosition = useMemo(() => {
    const hand1 = hands[0];
    const hand2 = hands[1];

    if (!hand1.isDetected || selectedShape !== 'model3D') {
      // Reset when exiting model3D mode
      if (model3DModeActiveRef.current) {
        model3DModeActiveRef.current = false;
        initialHandRotationRef.current = null;
      }
      return null;
    }

    // Initialize rotation reference when first entering model3D mode
    if (!model3DModeActiveRef.current && hand1.isDetected) {
      model3DModeActiveRef.current = true;
      initialHandRotationRef.current = {
        x: hand1.rotationX,
        y: hand1.rotationY,
        z: hand1.rotationZ
      };
      rotationZRef.current = 0; // Reset Z rotation for two-hand mode
    }

    let targetX = hand1.x;
    let targetY = hand1.y;
    let targetZ = hand1.z;
    let scale = 2;
    let rotX = 0, rotY = 0, rotZ = 0;

    if (hand2.isDetected) {
      targetX = (hand1.x + hand2.x) / 2;
      targetY = (hand1.y + hand2.y) / 2;
      targetZ = (hand1.z + hand2.z) / 2;

      const dist = Math.sqrt(
        Math.pow(hand1.x - hand2.x, 2) + 
        Math.pow(hand1.y - hand2.y, 2) +
        Math.pow(hand1.z - hand2.z, 2)
      );
      scale = Math.max(0.5, dist * 5);

      // Two hands: use rotation based on hand positions
      // Rotation logic for two hands: left hand above right hand = counter-clockwise
      const yDiff = hand1.y - hand2.y;
      if (Math.abs(yDiff) > 0.05) {
        if (yDiff < 0) {
          rotationZRef.current -= 0.05;
        } else {
          rotationZRef.current += 0.05;
        }
      }
      rotZ = rotationZRef.current;

      // Add X and Y rotation based on hand orientation (relative to initial)
      const xDiff = hand2.x - hand1.x;
      const zDiff = hand2.z - hand1.z;
      rotY = Math.atan2(xDiff, zDiff) * 0.5; // Reduced sensitivity
      rotX = Math.atan2(yDiff, Math.sqrt(xDiff * xDiff + zDiff * zDiff)) * 0.5;
    } else {
      // Single hand: use hand rotation delta from initial
      scale = Math.max(0.5, (hand1.fingersExtended / 5) * 3);
      
      if (initialHandRotationRef.current) {
        rotX = (hand1.rotationX - initialHandRotationRef.current.x) * 0.5;
        rotY = (hand1.rotationY - initialHandRotationRef.current.y) * 0.5;
        rotZ = (hand1.rotationZ - initialHandRotationRef.current.z) * 0.5;
      }
    }

    return {
      x: (0.5 - targetX) * 10,
      y: (0.5 - targetY) * 8,
      z: (targetZ * -15),
      scale,
      rotationX: rotX,
      rotationY: rotY,
      rotationZ: rotZ
    };
  }, [hands, selectedShape]);

  // Update loaded models positions when in model3D control mode
  useEffect(() => {
    if (modelControlPosition && loadedModels.length > 0) {
      console.log('🎮 Model control position:', modelControlPosition);
      setLoadedModels(prev => {
        // Check if any model needs updating
        const needsUpdate = prev.some(model => {
          const posChanged = !model.position || 
            model.position.x !== modelControlPosition.x ||
            model.position.y !== modelControlPosition.y ||
            model.position.z !== modelControlPosition.z;
          const scaleChanged = model.scale !== modelControlPosition.scale;
          const rotChanged = !model.rotation ||
            model.rotation.x !== modelControlPosition.rotationX ||
            model.rotation.y !== modelControlPosition.rotationY ||
            model.rotation.z !== modelControlPosition.rotationZ;
          return posChanged || scaleChanged || rotChanged;
        });

        if (!needsUpdate) return prev;

        console.log('✅ Updating model positions to:', modelControlPosition);
        return prev.map(model => ({
          ...model,
          position: {
            x: modelControlPosition.x,
            y: modelControlPosition.y,
            z: modelControlPosition.z
          },
          scale: modelControlPosition.scale,
          rotation: {
            x: modelControlPosition.rotationX,
            y: modelControlPosition.rotationY,
            z: modelControlPosition.rotationZ
          }
        }));
      });
    }
  }, [modelControlPosition, loadedModels.length]);

  // Separate effect for gesture detection
  useEffect(() => {
    const hand1 = hands[0];
    const hand2 = hands[1];

    if (hand1.isDetected && hand2.isDetected) {
      // GESTURE DETECTION: Place sphere when BOTH hands have 5 fingers extended
      if (hand1.fingersExtended === 5 && hand2.fingersExtended === 5) {
        if (!isPlacingRef.current && currentOrb) {
          const newOrb: Orb = {
            ...currentOrb,
            id: Math.random().toString()
          };
          setPlacedOrbs(prev => [...prev, newOrb]);
          isPlacingRef.current = true;
        }
      } else {
        isPlacingRef.current = false;
      }
      // Reset hold position when two hands are detected
      holdPositionRef.current = null;
    } else if (hand1.isDetected && !hand2.isDetected) {
      // GESTURE DETECTION: Place shape when single hand stays in position for 2 seconds
      const currentTime = Date.now();
      const threshold = 0.05; // Position movement threshold
      
      if (holdPositionRef.current) {
        // Check if hand has moved significantly
        const dx = Math.abs(hand1.x - holdPositionRef.current.x);
        const dy = Math.abs(hand1.y - holdPositionRef.current.y);
        const dz = Math.abs(hand1.z - holdPositionRef.current.z);
        
        if (dx > threshold || dy > threshold || dz > threshold) {
          // Hand moved, reset timer
          holdPositionRef.current = { x: hand1.x, y: hand1.y, z: hand1.z, startTime: currentTime };
          isPlacingRef.current = false;
        } else if (currentTime - holdPositionRef.current.startTime >= 2000) {
          // Hand held for 2 seconds, place the shape
          if (!isPlacingRef.current && currentOrb) {
            const newOrb: Orb = {
              ...currentOrb,
              id: Math.random().toString()
            };
            setPlacedOrbs(prev => [...prev, newOrb]);
            isPlacingRef.current = true;
            holdPositionRef.current = null; // Reset after placement
          }
        }
      } else {
        // Start tracking position
        holdPositionRef.current = { x: hand1.x, y: hand1.y, z: hand1.z, startTime: currentTime };
        isPlacingRef.current = false;
      }
    } else {
      isPlacingRef.current = false;
      holdPositionRef.current = null;
    }
  }, [hands, currentOrb]);

  const handleCameraReady = useCallback(() => setIsCameraActive(true), []);
  const handlePointsDetected = useCallback((points: Point[]) => setActiveEmitters(points), []);
  const handleHandsDetected = useCallback((handData: HandData[]) => setHands(handData), []);

  const summonBlessing = async () => {
    setIsSummoning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are a mystical celestial architect. The user is synthesizing ${placedOrbs.length} points of light in a ${settings.theme} themed digital environment. Provide a short, one-sentence poetic cosmic blessing or fortune. Be ethereal, magical, and brief.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setBlessing(response.text || "The light you manifest ripples through the deep fabric of space.");
    } catch (err) {
      setBlessing("The stars are silent tonight, but their light remains.");
    } finally {
      setIsSummoning(false);
    }
  };

  const takeScreenshot = useCallback(async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) return;

      // 1. Draw background color
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw video element
      if (videoRef.current && videoRef.current.readyState >= 2) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // 3. Draw gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(2, 6, 23, 0.4)');
      gradient.addColorStop(0.5, 'rgba(15, 23, 42, 0.4)');
      gradient.addColorStop(1, 'rgba(2, 6, 23, 0.4)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 4. Draw WebGL canvases (Three.js scene) with screen blend mode
      const webglCanvases = document.querySelectorAll('canvas');
      webglCanvases.forEach(webglCanvas => {
        if (webglCanvas !== canvas) {
          try {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.9;
            ctx.drawImage(webglCanvas, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } catch (e) {
            console.warn('Could not draw WebGL canvas:', e);
          }
        }
      });

      // 5. Capture UI overlay with html2canvas
      try {
        const uiCanvas = await html2canvas(document.body, {
          backgroundColor: null,
          scale: 1,
          logging: false,
          useCORS: true,
          allowTaint: true,
          ignoreElements: (element) => {
            return element.tagName === 'VIDEO' || element.tagName === 'CANVAS';
          }
        });
        
        ctx.drawImage(uiCanvas, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.warn('Could not capture UI overlay:', e);
      }

      // Download
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `snowman-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch (err) {
      console.error('Error taking screenshot:', err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) return;
      
      const stream = canvas.captureStream(30);
      
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snowman-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      let lastUiCanvas: HTMLCanvasElement | null = null;
      let frameCount = 0;
      
      const captureFrame = async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          return;
        }

        // 1. Draw background
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw video
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        // 3. Draw gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'rgba(2, 6, 23, 0.4)');
        gradient.addColorStop(0.5, 'rgba(15, 23, 42, 0.4)');
        gradient.addColorStop(1, 'rgba(2, 6, 23, 0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 4. Draw WebGL canvases
        const webglCanvases = document.querySelectorAll('canvas');
        webglCanvases.forEach(webglCanvas => {
          if (webglCanvas !== canvas) {
            try {
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              ctx.globalAlpha = 0.9;
              ctx.drawImage(webglCanvas, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            } catch (e) {
              // Ignore WebGL read errors
            }
          }
        });

        // 5. Capture UI overlay every 10 frames to improve performance
        if (frameCount % 10 === 0) {
          try {
            lastUiCanvas = await html2canvas(document.body, {
              backgroundColor: null,
              scale: 1,
              logging: false,
              useCORS: true,
              allowTaint: true,
              ignoreElements: (element) => {
                return element.tagName === 'VIDEO' || element.tagName === 'CANVAS';
              }
            });
          } catch (err) {
            // Ignore UI capture errors
          }
        }
        
        // Draw the last captured UI
        if (lastUiCanvas) {
          ctx.drawImage(lastUiCanvas, 0, 0, canvas.width, canvas.height);
        }

        frameCount++;
        requestAnimationFrame(captureFrame);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      captureFrame();
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleAddAsset = useCallback((type: 'image' | 'model', url: string, thumbnail?: string) => {
    const newAsset: Asset = {
      id: Date.now().toString(),
      type,
      url,
      thumbnail,
      createdAt: Date.now()
    };
    setAssets(prev => [newAsset, ...prev]);
  }, []);

  const handleAddAssetToScene = useCallback((asset: Asset, modelUrl?: string) => {
    console.log('🎯 Adding asset to scene:', asset, 'modelUrl:', modelUrl);
    
    // If a modelUrl is provided (from generated 3D), use that instead
    if (modelUrl) {
      const newModel = {
        id: `${asset.id}-3d`,
        url: modelUrl,
        position: { x: 0, y: 0, z: 0 }, // Center of scene
        scale: 2 // Default scale
      };
      
      setLoadedModels(prev => {
        // Check if model already exists
        if (prev.some(m => m.id === newModel.id)) {
          console.log('⚠️ Model already in scene:', newModel.id);
          return prev;
        }
        console.log('✅ Adding generated 3D model to scene:', newModel.id);
        return [...prev, newModel];
      });
    } else if (asset.type === 'model') {
      // Add 3D model to the scene
      const newModel = {
        id: asset.id,
        url: asset.url,
        position: { x: 0, y: 0, z: 0 }, // Center of scene
        scale: 2 // Default scale
      };
      
      setLoadedModels(prev => {
        // Check if model already exists
        if (prev.some(m => m.id === asset.id)) {
          console.log('⚠️ Model already in scene:', asset.id);
          return prev;
        }
        console.log('✅ Adding model to scene:', asset.id);
        return [...prev, newModel];
      });
    } else if (asset.type === 'image') {
      // For images without 3D model, we could create a plane with the image as texture
      console.log('📷 Image assets not yet supported in 3D scene');
      // TODO: Implement image plane in scene
    }
  }, []);

  const handleFistDetected = useCallback((detected: boolean, x: number, y: number) => {
    setFistState({ detected, x, y, lastSeen: Date.now() });
  }, []);

  const handleHandDetected = useCallback((detected: boolean, x: number, y: number) => {
    setHandState({ detected, x, y, lastSeen: Date.now() });
  }, []);

  const themeColors = {
    midnight: 'from-[#020617] via-[#0f172a] to-[#020617]',
    solstice: 'from-[#1a0f02] via-[#2a1b0f] to-[#1a0f02]',
    aurora: 'from-[#061702] via-[#0f2a1a] to-[#061702]'
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none transition-colors duration-1000">
      <div 
        className={`absolute inset-0 z-0 mystical-video transition-all duration-1000 ${
          settings.filterMode === 'mystical' ? 'opacity-40' : 
          settings.filterMode === 'popart' ? 'opacity-100' : 
          'opacity-100'
        } ${
          settings.theme === 'solstice' && settings.filterMode === 'mystical' ? 'sepia-[0.3] saturate-150' : ''
        }`}
        style={{
          filter: settings.filterMode === 'popart' ? 'contrast(1.8) saturate(1.8) brightness(1.15) hue-rotate(-5deg)' : 'none'
        }}
      >
        <LightDetector 
          videoRef={videoRef}
          settings={settings} 
          onPointsDetected={handlePointsDetected} 
          onCameraReady={handleCameraReady} 
        />
        <HandTracker 
          videoRef={videoRef}
          onHandsDetected={handleHandsDetected} 
        />
      </div>

      {settings.filterMode === 'mystical' && (
        <div className={`absolute inset-0 z-[1] pointer-events-none mix-blend-screen opacity-70 bg-gradient-to-br ${themeColors[settings.theme]} transition-all duration-1000`} />
      )}

      {settings.filterMode === 'popart' && (
        <div 
          className="absolute inset-0 z-[1] pointer-events-none transition-all duration-500"
          style={{
            background: 'linear-gradient(45deg, #ff00ff 0%, #ffff00 33%, #00ffff 66%, #ff0000 100%)',
            mixBlendMode: 'overlay',
            opacity: 0.8
          }}
        />
      )}

      <div className={`absolute inset-0 z-[3] ${settings.filterMode === 'mystical' ? 'mix-blend-screen opacity-90' : 'opacity-100'}`}>
        <Scene3D activeOrb={currentOrb} placedOrbs={placedOrbs} theme={settings.theme} loadedModels={loadedModels} />
      </div>

      {selectedShape === 'none' && <SnowOverlay emitters={activeEmitters} settings={settings} />}

      {settings.filterMode === 'popart' && (
        <>
          <HandGestureDetector 
            videoRef={videoRef}
            onOpenHandDetected={handleHandDetected}
            onFistDetected={handleFistDetected}
            isActive={isCameraActive}
          />
          <HiGraphic state={handState} />
          <PowGraphic state={fistState} />
        </>
      )}

      <AssetPanel 
        assets={assets}
        onAddToScene={handleAddAssetToScene}
        descriptionInput={descriptionInput}
        onDescriptionChange={setDescriptionInput}
        isGenerating={isGenerating}
        onSubmit={() => submitHandlerRef.current?.()}
      />

      <UIOverlay 
        settings={settings} setSettings={setSettings} 
        isCameraActive={isCameraActive} 
        onSummonBlessing={summonBlessing} isSummoning={isSummoning}
        blessing={blessing} onClearBlessing={() => setBlessing(null)}
        selectedShape={selectedShape} setSelectedShape={setSelectedShape}
        onTakeScreenshot={takeScreenshot}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        isRecording={isRecording}
        onAddAsset={handleAddAsset}
        descriptionInput={descriptionInput}
        setDescriptionInput={setDescriptionInput}
        isGenerating={isGenerating}
        setIsGenerating={setIsGenerating}
        submitHandlerRef={submitHandlerRef}
      />

      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)] z-10" />
    </div>
  );
};

export default App;
