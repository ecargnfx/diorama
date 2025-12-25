
import React, { useRef, useEffect } from 'react';
import { Point, DetectionSettings, Particle } from '../types';

interface MysticalParticle extends Particle {
  angle: number;
  angularVelocity: number;
  amplitude: number;
  frequency: number;
}

interface Props {
  emitters: Point[];
  settings: DetectionSettings;
}

const SnowOverlay: React.FC<Props> = ({ emitters, settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<MysticalParticle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const drawStar = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Create particles from emitters
      if (emitters.length > 0) {
        const burstSize = Math.max(1, Math.floor(10 * settings.sensitivity));
        for (let i = 0; i < burstSize; i++) {
          const emitter = emitters[Math.floor(Math.random() * emitters.length)];
          if (particlesRef.current.length < settings.particleCount) {
            const isStar = Math.random() > 0.95;
            particlesRef.current.push({
              x: emitter.x * canvas.width + (Math.random() - 0.5) * 40,
              y: emitter.y * canvas.height + (Math.random() - 0.5) * 40,
              vx: (Math.random() - 0.5) * 1.5,
              vy: Math.random() * 0.8 + 0.2,
              radius: isStar ? Math.random() * 3 + 2 : Math.random() * 2.5 + 0.5,
              alpha: Math.random() * 0.6 + 0.4,
              life: 1.0,
              angle: Math.random() * Math.PI * 2,
              angularVelocity: (Math.random() - 0.5) * 0.05,
              amplitude: Math.random() * 3 + 1,
              frequency: Math.random() * 0.02 + 0.005,
              color: emitter.color,
              type: isStar ? 'star' : 'flake'
            });
          }
        }
      }

      // 2. Update and Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        
        p.angle += p.angularVelocity;
        p.vy += settings.gravity;
        
        // Reactive "swirl" away from emitters
        let repelX = 0;
        let repelY = 0;
        emitters.forEach(e => {
            const dx = p.x - (e.x * canvas.width);
            const dy = p.y - (e.y * canvas.height);
            const distSq = dx*dx + dy*dy;
            if (distSq < 2500) { // 50px radius
                const force = (1 - Math.sqrt(distSq) / 50) * 0.5;
                repelX += (dx / Math.sqrt(distSq)) * force;
                repelY += (dy / Math.sqrt(distSq)) * force;
            }
        });

        const drift = Math.sin(Date.now() * p.frequency + p.angle) * p.amplitude;
        p.x += p.vx + drift + repelX;
        p.y += p.vy + repelY;
        
        p.life -= 0.0025;
        if (p.y > canvas.height) p.life -= 0.05;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        const opacity = p.alpha * p.life;
        const size = p.radius * (0.8 + Math.sin(Date.now() * 0.002 + p.angle) * 0.2);
        
        ctx.save();
        if (p.type === 'star') {
            // Draw a glowing star
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            drawStar(p.x, p.y, 5, size, size/2);
            ctx.fill();
        } else {
            // Draw a glowing flake
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
            gradient.addColorStop(0, p.color.replace(')', `, ${opacity})`).replace('rgb', 'rgba'));
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
            ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [emitters, settings]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-20 pointer-events-none mix-blend-screen" 
    />
  );
};

export default SnowOverlay;
