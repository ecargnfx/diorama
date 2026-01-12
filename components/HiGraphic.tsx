
import React, { useEffect, useState } from 'react';
import { HandState } from '../types';

interface Props {
  state: HandState;
}

const HiGraphic: React.FC<Props> = ({ state }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state.detected) {
      setVisible(true);
      setPosition({ x: state.x, y: state.y });
      setKey(prev => prev + 1);
      
      const timer = setTimeout(() => {
        setVisible(false);
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [state.detected, state.lastSeen]);

  if (!visible) return null;

  return (
    <div 
      key={key}
      className="absolute z-40 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-[pop_0.3s_ease-out]"
      style={{ 
        left: `${position.x * 100}%`, 
        top: `${position.y * 100}%`,
        filter: 'drop-shadow(8px 8px 0px rgba(0,0,0,0.7))'
      }}
    >
      <div className="relative">
        <svg width="220" height="160" viewBox="0 0 200 140" className="overflow-visible">
          <ellipse 
            cx="100" 
            cy="60" 
            rx="90" 
            ry="55" 
            fill="#ffffff" 
            stroke="#000" 
            strokeWidth="6"
          />
          <path 
            d="M 70 100 L 50 130 L 90 105 Z" 
            fill="#ffffff" 
            stroke="#000" 
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <text 
            x="50%" 
            y="48%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            className="font-black select-none"
            style={{ 
              fontSize: '3.5rem',
              fontFamily: 'Impact, Arial Black, sans-serif',
              fill: '#ff1493', 
              stroke: '#000', 
              strokeWidth: '2px',
              paintOrder: 'stroke fill'
            }}
          >
            Hi!
          </text>
        </svg>
      </div>
    </div>
  );
};

export default HiGraphic;
