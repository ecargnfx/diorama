
import React, { useEffect, useRef } from 'react';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onOpenHandDetected: (detected: boolean, x: number, y: number) => void;
  onFistDetected: (detected: boolean, x: number, y: number) => void;
  isActive: boolean;
}

// Declare MediaPipe types on window
declare global {
  interface Window {
    Hands: any;
  }
}

const HandGestureDetector: React.FC<Props> = ({ 
  videoRef, 
  onOpenHandDetected, 
  onFistDetected, 
  isActive 
}) => {
  const handsRef = useRef<any>(null);
  const animationRef = useRef<number>();
  const lastOpenHandTime = useRef<number>(0);
  const lastFistTime = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    // Load MediaPipe Hands script
    const loadMediaPipe = async () => {
      if (!window.Hands) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      console.log("🤖 Initializing MediaPipe Hands for gesture detection...");

      // Initialize MediaPipe Hands with correct CDN path
      const hands = new window.Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Check for both open hand and fist
        const fingertips = [4, 8, 12, 16, 20]; // all fingertips
        const palmBase = [1, 5, 9, 13, 17]; // thumb base + finger bases
        
        // Calculate finger spread (for open hand)
        let fingerSpread = 0;
        for (let i = 0; i < fingertips.length - 1; i++) {
          const p1 = landmarks[fingertips[i]];
          const p2 = landmarks[fingertips[i + 1]];
          const dist = Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
          );
          fingerSpread += dist;
        }
        
        // Calculate finger curl (for fist)
        let fingerCurl = 0;
        for (let i = 1; i < fingertips.length; i++) { // Skip thumb
          const tip = landmarks[fingertips[i]];
          const base = landmarks[palmBase[i]];
          const dist = Math.sqrt(
            Math.pow(tip.x - base.x, 2) + Math.pow(tip.y - base.y, 2)
          );
          fingerCurl += dist;
        }
        
        const now = Date.now();
        
        // Detect open hand (fingers spread)
        const isOpenHand = fingerSpread > 0.3;
        if (isOpenHand && now - lastOpenHandTime.current > 800) {
          // Calculate center of fingertips
          let sumX = 0, sumY = 0;
          fingertips.forEach(idx => {
            sumX += landmarks[idx].x;
            sumY += landmarks[idx].y;
          });
          const fingertipsX = sumX / fingertips.length;
          const fingertipsY = sumY / fingertips.length;
          
          console.log("✋ Open hand detected at:", fingertipsX.toFixed(2), fingertipsY.toFixed(2));
          onOpenHandDetected(true, fingertipsX, fingertipsY);
          lastOpenHandTime.current = now;
        }
        // Detect fist (fingers curled)
        else if (fingerCurl < 0.25 && now - lastFistTime.current > 800) {
          // Calculate center of hand
          let sumX = 0, sumY = 0;
          const handCenter = [0, 5, 9, 13, 17];
          handCenter.forEach(idx => {
            sumX += landmarks[idx].x;
            sumY += landmarks[idx].y;
          });
          const fistX = sumX / handCenter.length;
          const fistY = sumY / handCenter.length;
          
          console.log("👊 Fist detected at:", fistX.toFixed(2), fistY.toFixed(2));
          onFistDetected(true, fistX, fistY);
          lastFistTime.current = now;
        }
      }
    });

      handsRef.current = hands;
      console.log("✅ Hand gesture detector initialized!");

      // Process video frames
      const processFrame = async () => {
        if (videoRef.current && handsRef.current && videoRef.current.readyState === 4) {
          await handsRef.current.send({ image: videoRef.current });
        }
        animationRef.current = requestAnimationFrame(processFrame);
      };

      animationRef.current = requestAnimationFrame(processFrame);
    };

    loadMediaPipe();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, [isActive, onOpenHandDetected, onFistDetected, videoRef]);

  return null;
};

export default HandGestureDetector;
