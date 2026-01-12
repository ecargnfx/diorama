
import React, { useEffect, useState } from 'react';
import { FistState } from '../types';

interface Props {
  state: FistState;
}

const PowGraphic: React.FC<Props> = ({ state }) => {
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
      }, 800);

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
        filter: 'drop-shadow(10px 10px 0px rgba(0,0,0,0.8))'
      }}
    >
      <div className="relative">
        <svg width="280" height="200" viewBox="0 0 240 180" className="overflow-visible">
          <path 
            d="M 120 10 L 140 40 L 180 30 L 170 60 L 210 70 L 180 90 L 220 120 L 170 120 L 160 160 L 120 130 L 80 160 L 70 120 L 20 120 L 60 90 L 30 70 L 70 60 L 60 30 L 100 40 Z" 
            fill="#ffff00" 
            stroke="#000" 
            strokeWidth="8"
          />
          <text 
            x="50%" 
            y="55%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            className="font-black italic select-none"
            style={{ 
              fontSize: '4rem',
              fontFamily: 'Impact, Arial Black, sans-serif',
              fill: '#ff0000', 
              stroke: '#000', 
              strokeWidth: '3px',
              paintOrder: 'stroke fill'
            }}
          >
            POW!
          </text>
        </svg>
      </div>
    </div>
  );
};

export default PowGraphic;
