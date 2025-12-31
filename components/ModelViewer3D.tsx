import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface ModelViewer3DProps {
  modelUrl: string;
  onHover?: (isHovering: boolean) => void;
  onClick?: () => void;
  onLoadingProgress?: (progress: number) => void;
  onLoaded?: () => void;
}

const ModelViewer3D: React.FC<ModelViewer3DProps> = ({ modelUrl, onHover, onClick, onLoadingProgress, onLoaded }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameIdRef = useRef<number>();
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    
    const currentMount = mountRef.current;
    
    // Check if canvas already exists in the mount
    if (currentMount.querySelector('canvas')) {
      console.log('⚠️ Canvas already exists in mount, skipping');
      return;
    }

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0.5, 2.5);

    // Renderer - use lower power settings to reduce context usage
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false, 
      alpha: true,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false
    });
    renderer.setSize(256, 256);
    renderer.setPixelRatio(1); // Limit pixel ratio to save resources
    renderer.setClearColor(0x000000, 0);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    console.log('🎮 Created WebGL context for ModelViewer3D');

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 5, 5);
    scene.add(light);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2;
    controls.enableZoom = false;

    // Load model
    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        
        // Center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        scene.add(model);
        
        onLoaded?.();
      },
      (progress) => {
        const percent = progress.total > 0 ? (progress.loaded / progress.total * 100) : 0;
        onLoadingProgress?.(percent);
      },
      (error) => console.error('Error loading model:', error)
    );

    // Animation
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Mouse events
    const canvas = renderer.domElement;
    const handleMouseEnter = () => {
      controls.autoRotateSpeed = 4;
      onHover?.(true);
    };
    const handleMouseLeave = () => {
      controls.autoRotateSpeed = 2;
      onHover?.(false);
    };
    const handleClick = () => onClick?.();

    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up ModelViewer3D WebGL context');
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (currentMount.contains(canvas)) currentMount.removeChild(canvas);
      rendererRef.current = null;
    };
  }, [modelUrl, onHover, onClick, onLoadingProgress, onLoaded]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ModelViewer3D;
