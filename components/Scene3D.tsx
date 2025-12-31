
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Orb, Theme } from '../types';

interface LoadedModel {
  id: string;
  url: string;
  position?: { x: number; y: number; z: number };
  scale?: number;
}

interface Props {
  activeOrb: Orb | null;
  placedOrbs: Orb[];
  theme: Theme;
  loadedModels?: LoadedModel[];
}

const Scene3D: React.FC<Props> = ({ activeOrb, placedOrbs, theme, loadedModels = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    orbsMap: Map<string, THREE.Mesh>;
    modelsMap: Map<string, THREE.Group>;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    
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
    const modelsMap = new Map<string, THREE.Group>();

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

    sceneRef.current = { scene, camera, renderer, orbsMap, modelsMap };

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
          opacity: 0.6,
          transmission: 0.5,
          thickness: 0.5,
          roughness: 0.1,
          metalness: 0.2,
          emissive: orb.color,
          emissiveIntensity: 0.8,
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

  // Handle loaded 3D models
  useEffect(() => {
    if (!sceneRef.current) return;
    const { scene, modelsMap } = sceneRef.current;

    const currentModelIds = new Set(loadedModels.map(m => m.id));

    // Remove old models
    modelsMap.forEach((model, id) => {
      if (!currentModelIds.has(id)) {
        scene.remove(model);
        modelsMap.delete(id);
        console.log('🗑️ Removed model from scene:', id);
      }
    });

    // Load new models or update existing ones
    loadedModels.forEach(modelData => {
      const existingModel = modelsMap.get(modelData.id);
      
      if (existingModel) {
        // Update position and scale of existing model
        if (modelData.position) {
          existingModel.position.set(
            modelData.position.x,
            modelData.position.y,
            modelData.position.z
          );
        }
        if (modelData.scale) {
          const currentScale = existingModel.scale.x;
          const newScale = modelData.scale;
          if (Math.abs(currentScale - newScale) > 0.01) {
            existingModel.scale.setScalar(newScale);
          }
        }
      } else {
        // Load new model
        console.log('📦 Loading model into scene:', modelData.url);
        const loader = new GLTFLoader();
        loader.load(
          modelData.url,
          (gltf) => {
            const model = gltf.scene;
            
            // Center and scale model
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetScale = modelData.scale || 2;
            const scale = targetScale / maxDim;
            
            model.scale.setScalar(scale);
            model.position.sub(center.multiplyScalar(scale));
            
            // Apply position if provided
            if (modelData.position) {
              model.position.add(new THREE.Vector3(
                modelData.position.x,
                modelData.position.y,
                modelData.position.z
              ));
            }
            
            scene.add(model);
            modelsMap.set(modelData.id, model);
            console.log('✅ Model added to scene:', modelData.id);
          },
          (progress) => {
            const percent = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
            console.log(`Loading model ${modelData.id}: ${percent}%`);
          },
          (error) => {
            console.error('❌ Error loading model into scene:', error);
          }
        );
      }
    });
  }, [loadedModels]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Scene3D;
