
import React, { useEffect } from 'react';
import * as HandsNS from '@mediapipe/hands';
import { HandData } from '../types';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onHandsDetected: (hands: HandData[]) => void;
}

const HandTracker: React.FC<Props> = ({ videoRef, onHandsDetected }) => {
  useEffect(() => {
    const Hands = HandsNS.Hands || (HandsNS as any).default?.Hands;
    
    if (!Hands) {
      console.error("Mediapipe Hands constructor not found.");
      return;
    }

    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results: any) => {
      const detected: HandData[] = [
        { x: 0, y: 0, z: 0, isDetected: false, fingersExtended: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
        { x: 0, y: 0, z: 0, isDetected: false, fingersExtended: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
      ];

      if (results.multiHandLandmarks) {
        results.multiHandLandmarks.forEach((landmarks: any[], index: number) => {
          if (index < 2) {
            // Calculate midpoint between thumb tip and index finger tip
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const center = {
              x: (thumbTip.x + indexTip.x) / 2,
              y: (thumbTip.y + indexTip.y) / 2,
              z: (thumbTip.z + indexTip.z) / 2
            };
            
            // Calculate rotation using thumb-to-index finger angle for precise control
            // Vector from thumb tip to index tip
            const fingerVector = {
              x: indexTip.x - thumbTip.x,
              y: indexTip.y - thumbTip.y,
              z: indexTip.z - thumbTip.z
            };
            
            // Calculate rotation around Z-axis (roll - rotating fingers in 2D plane)
            const rotationZ = Math.atan2(fingerVector.y, fingerVector.x);
            
            // Calculate rotation around X-axis (pitch - fingers pointing up/down)
            const horizontalDist = Math.sqrt(fingerVector.x * fingerVector.x + fingerVector.y * fingerVector.y);
            const rotationX = Math.atan2(-fingerVector.z, horizontalDist);
            
            // Calculate rotation around Y-axis (yaw - fingers pointing left/right in 3D)
            const rotationY = Math.atan2(fingerVector.x, Math.sqrt(fingerVector.y * fingerVector.y + fingerVector.z * fingerVector.z));
            
            // Finger counting logic
            let count = 0;
            
            // Tips: Thumb(4), Index(8), Middle(12), Ring(16), Pinky(20)
            // Refs: Thumb(3), Index(6), Middle(10), Ring(14), Pinky(18)
            
            // Check fingers (using Y-axis for standard orientation)
            if (landmarks[8].y < landmarks[6].y) count++;   // Index
            if (landmarks[12].y < landmarks[10].y) count++; // Middle
            if (landmarks[16].y < landmarks[14].y) count++; // Ring
            if (landmarks[20].y < landmarks[18].y) count++; // Pinky
            
            // Thumb is special (check X-axis distance from base)
            // We compare distance between thumb tip and pinky base to thumb base and pinky base
            const thumbBase = landmarks[2];
            const pinkyBase = landmarks[17];
            
            const tipDist = Math.sqrt(Math.pow(thumbTip.x - pinkyBase.x, 2) + Math.pow(thumbTip.y - pinkyBase.y, 2));
            const baseDist = Math.sqrt(Math.pow(thumbBase.x - pinkyBase.x, 2) + Math.pow(thumbBase.y - pinkyBase.y, 2));
            
            if (tipDist > baseDist) count++;

            detected[index] = {
              x: center.x,
              y: center.y,
              z: center.z,
              isDetected: true,
              fingersExtended: count,
              rotationX,
              rotationY,
              rotationZ
            };
          }
        });
      }
      onHandsDetected(detected);
    });

    let processing = true;
    const processFrame = async () => {
      if (!processing) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused) {
        try {
          await hands.send({ image: video });
        } catch (e) {}
      }
      requestAnimationFrame(processFrame);
    };

    const animId = requestAnimationFrame(processFrame);

    return () => {
      processing = false;
      cancelAnimationFrame(animId);
      hands.close();
    };
  }, [onHandsDetected, videoRef]);

  return null;
};

export default HandTracker;
