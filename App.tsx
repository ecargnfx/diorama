
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DetectionSettings, Point, HandData, Orb, ShapeType } from './types';
import LightDetector from './components/LightDetector';
import HandTracker from './components/HandTracker';
import Scene3D from './components/Scene3D';
import SnowOverlay from './components/SnowOverlay';
import UIOverlay from './components/UIOverlay';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [settings, setSettings] = useState<DetectionSettings>({
    threshold: 240, 
    sensitivity: 0.6,
    particleCount: 1500,
    gravity: 0.03,
    theme: 'midnight'
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeEmitters, setActiveEmitters] = useState<Point[]>([]);
  const [hands, setHands] = useState<HandData[]>([
    { x: 0, y: 0, z: 0, isDetected: false, fingersExtended: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
    { x: 0, y: 0, z: 0, isDetected: false, fingersExtended: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
  ]);
  const [placedOrbs, setPlacedOrbs] = useState<Orb[]>([]);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('sphere');
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [blessing, setBlessing] = useState<string | null>(null);
  const [isSummoning, setIsSummoning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Ref to track if we've already placed an orb for the current gesture to prevent multi-firing
  const isPlacingRef = useRef(false);
  const rotationZRef = useRef(0);
  const lastRadiusRef = useRef(0.5);
  const holdPositionRef = useRef<{ x: number; y: number; z: number; startTime: number } | null>(null);

  // Calculate current orb position using useMemo to prevent unnecessary re-renders
  const currentOrb = useMemo(() => {
    const hand1 = hands[0];
    const hand2 = hands[1];

    if (!hand1.isDetected || selectedShape === 'none') return null;

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

    const color = selectedShape === 'brownSphere' ? '#92400e' : 
                  selectedShape === 'cone' ? '#ff8800' : 
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

  const testBackendConnection = async () => {
    try {
      const response = await fetch(`https://new.playhouse.ai/api-gtw/auth/ping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status === "ok") {
        const statusEl = document.getElementById('status');
        if (statusEl) {
          statusEl.textContent = "Server connected!";
          statusEl.style.color = 'green';
        }
        console.log("Server connected successfully");
      } else {
        throw new Error(`Server error: ${data.status}`);
      }
    } catch (error: any) {
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = `Connection failed: ${error.message}`;
        statusEl.style.color = 'red';
      }
      console.error("Connection test failed:", error);
    }
  };

  useEffect(() => {
    testBackendConnection();
  }, []);

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

  const themeColors = {
    midnight: 'from-[#020617] via-[#0f172a] to-[#020617]',
    solstice: 'from-[#1a0f02] via-[#2a1b0f] to-[#1a0f02]',
    aurora: 'from-[#061702] via-[#0f2a1a] to-[#061702]'
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none transition-colors duration-1000">
      <div id="status" className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-mono bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">Testing connection...</div>
      <div className={`absolute inset-0 z-0 opacity-40 mystical-video transition-all duration-1000 ${settings.theme === 'solstice' ? 'sepia-[0.3] saturate-150' : ''}`}>
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

      <div className={`absolute inset-0 z-[1] pointer-events-none mix-blend-screen opacity-70 bg-gradient-to-br ${themeColors[settings.theme]} transition-all duration-1000`} />

      <div className="absolute inset-0 z-[2] opacity-30 pointer-events-none animate-mystical bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

      <div className="absolute inset-0 z-[3] mix-blend-screen opacity-90">
        <Scene3D activeOrb={currentOrb} placedOrbs={placedOrbs} theme={settings.theme} />
      </div>

      <SnowOverlay emitters={activeEmitters} settings={settings} />

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
      />

      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)] z-10" />
    </div>
  );
};

export default App;
