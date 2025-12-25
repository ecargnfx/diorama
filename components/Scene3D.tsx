
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Orb, Theme } from '../types';

interface Props {
  activeOrb: Orb | null;
  placedOrbs: Orb[];
  theme: Theme;
}

const Scene3D: React.FC<Props> = ({ activeOrb, placedOrbs, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    orbsMap: Map<string, THREE.Mesh>;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 50);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);

    camera.position.z = 5;

    const orbsMap = new Map<string, THREE.Mesh>();

    const animate = () => {
      requestAnimationFrame(animate);
      
      // Animate active orb's emissive intensity
      orbsMap.forEach((mesh, id) => {
        if (id === 'active') {
          (mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 1.2 + Math.sin(Date.now() * 0.005) * 0.4;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { scene, camera, renderer, orbsMap };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene, orbsMap } = sceneRef.current;

    const allOrbs = activeOrb ? [...placedOrbs, activeOrb] : placedOrbs;
    const currentIds = new Set(allOrbs.map(o => o.id));

    // Remove old orbs
    orbsMap.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        orbsMap.delete(id);
      }
    });

    // Add/Update orbs
    allOrbs.forEach(orb => {
      let mesh = orbsMap.get(orb.id);
      if (!mesh) {
        let geometry: THREE.BufferGeometry;
        
        // Create geometry based on shape type
        if (orb.shape === 'cone') {
          geometry = new THREE.ConeGeometry(1, 2, 32);
        } else {
          geometry = new THREE.SphereGeometry(1, 32, 32);
        }
        
        const material = new THREE.MeshPhysicalMaterial({
          color: orb.color,
          transparent: true,
          opacity: orb.shape === 'brownSphere' ? 0.9 : 0.6,
          transmission: orb.shape === 'brownSphere' ? 0 : 0.5,
          thickness: 0.5,
          roughness: orb.shape === 'brownSphere' ? 0.3 : 0.1,
          metalness: orb.shape === 'brownSphere' ? 0.8 : 0.2,
          emissive: orb.color,
          emissiveIntensity: orb.shape === 'brownSphere' ? 0.2 : 0.8,
        });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        orbsMap.set(orb.id, mesh);
      }

      mesh.position.set(orb.x, orb.y, orb.z);
      mesh.scale.set(orb.radius, orb.radius, orb.radius);
      mesh.rotation.x = orb.rotationX;
      mesh.rotation.y = orb.rotationY;
      mesh.rotation.z = orb.rotationZ;
    });
  }, [activeOrb, placedOrbs]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Scene3D;
