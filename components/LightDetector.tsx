
import React, { useRef, useEffect, useCallback } from 'react';
import { Point, DetectionSettings } from '../types';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  settings: DetectionSettings;
  onPointsDetected: (points: Point[]) => void;
  onCameraReady: () => void;
}

const LightDetector: React.FC<Props> = ({ videoRef, settings, onPointsDetected, onCameraReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    async function setupCamera() {
      try {
        // Broadened constraints for better compatibility
        const constraints = { 
          video: { 
            facingMode: 'user', 
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          } 
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (active && videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          
          // Ensure play is called as some browsers require it even with autoPlay
          videoRef.current.onloadedmetadata = async () => {
            try {
              if (videoRef.current) {
                await videoRef.current.play();
                onCameraReady();
              }
            } catch (playErr) {
              console.error("Video play failed:", playErr);
            }
          };
        }
      } catch (err) {
        console.error("Camera access failed:", err);
        // Fallback: try more basic constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (active && videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            streamRef.current = fallbackStream;
            videoRef.current.onloadedmetadata = () => onCameraReady();
          }
        } catch (fallbackErr) {
          console.error("Camera fallback failed:", fallbackErr);
        }
      }
    }
    setupCamera();
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onCameraReady, videoRef]);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return;

    if (video.readyState >= 2 && video.videoWidth > 0) {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const detectedPoints: Point[] = [];

      const step = 15;
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const i = (y * canvas.width + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          
          const brightness = (r + g + b) / 3;

          if (brightness >= settings.threshold) {
            detectedPoints.push({ 
              x: x / canvas.width, 
              y: y / canvas.height, 
              intensity: brightness,
              color: `rgb(${r},${g},${b})`
            });
          }
        }
      }

      const clusteredPoints: Point[] = [];
      const gridSize = 0.1; 
      const grid: Record<string, Point[]> = {};

      detectedPoints.forEach(p => {
        const gx = Math.floor(p.x / gridSize);
        const gy = Math.floor(p.y / gridSize);
        const key = `${gx},${gy}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(p);
      });

      Object.values(grid).forEach(pts => {
        const avgX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const avgY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const avgIntensity = pts.reduce((sum, p) => sum + p.intensity, 0) / pts.length;
        const midPoint = pts[Math.floor(pts.length / 2)];
        clusteredPoints.push({ x: avgX, y: avgY, intensity: avgIntensity, color: midPoint.color });
      });

      onPointsDetected(clusteredPoints);
    }
    requestAnimationFrame(processFrame);
  }, [settings.threshold, onPointsDetected, videoRef]);

  useEffect(() => {
    const animId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(animId);
  }, [processFrame]);

  return (
    <>
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
};

export default LightDetector;
