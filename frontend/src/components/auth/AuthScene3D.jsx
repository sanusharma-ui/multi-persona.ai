import { useEffect, useRef } from "react";
import * as THREE from "three";


export default function AuthScene3D() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Dimensions
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.z = 24;

    // Renderer
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // WebGL not supported, graceful fallback
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0); // fully transparent
    container.appendChild(renderer.domElement);

    // Group for mouse parallax tilt
    const parallaxGroup = new THREE.Group();
    scene.add(parallaxGroup);

  
    const particleCount = 380;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    const palette = [
      new THREE.Color("#c4b5fd"), // Soft violet
      new THREE.Color("#818cf8"), // Periwinkle
      new THREE.Color("#38bdf8"), // Cosmic cyan
      new THREE.Color("#fef08a"), // St/ Pure white
      new THREE.Color("#ffffff"), // Pure white
    ];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Spread across 3D volume
      positions[i3] = (Math.random() - 0.5) * 44;
      positions[i3 + 1] = (Math.random() - 0.5) * 28;
      positions[i3 + 2] = (Math.random() - 0.5) * 20;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;

      scales[i] = Math.random() * 0.8 + 0.4;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Custom circle particle texture
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(230,230,255,0.8)");
    grad.addColorStop(0.7, "rgba(180,160,255,0.2)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const particleTexture = new THREE.CanvasTexture(canvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.35,
      map: particleTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.75,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    parallaxGroup.add(particles);

    // ------------------------------------------------------------------------
    // 2. Celestial Orbital Rings (Motif echoing Seven's Halo and Neo's Sphere)
    // ------------------------------------------------------------------------
    const ringGroup = new THREE.Group();
    // Position slightly offset towards the upper right/center to harmonize with the scene
    ringGroup.position.set(4, 2.5, -6);
    ringGroup.rotation.x = Math.PI / 4.2;
    ringGroup.rotation.y = -Math.PI / 6;

    // Inner orbital ring
    const ringGeo1 = new THREE.TorusGeometry(5.2, 0.022, 16, 120);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xc4b5fd,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringGroup.add(ring1);

    // Outer orbital ring
    const ringGeo2 = new THREE.TorusGeometry(7.0, 0.016, 16, 140);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringGroup.add(ring2);

    // Ring node stars (small glowing spheres along the rings)
    const nodeGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    for (let k = 0; k < 6; k++) {
      const angle = (k / 6) * Math.PI * 2;
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(Math.cos(angle) * 5.2, Math.sin(angle) * 5.2, 0);
      ringGroup.add(node);
    }

    parallaxGroup.add(ringGroup);

    // ------------------------------------------------------------------------
    // 3. Floating Multiverse Crystal Shards
    // ------------------------------------------------------------------------
    const shardsGroup = new THREE.Group();
    const shards = [];

    // Geometries for shards
    const shardGeos = [
      new THREE.OctahedronGeometry(0.75, 0),
      new THREE.IcosahedronGeometry(0.65, 0),
      new THREE.TetrahedronGeometry(0.7, 0),
    ];

    const shardMaterials = [
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
      }),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      }),
      new THREE.MeshBasicMaterial({
        color: 0xf472b6,
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      }),
    ];

    // Seed floating shard positions (avoiding heavy center concentration)
    const shardConfigs = [
      { pos: [-12, 6, -2], rotSpeed: [0.006, 0.008, 0.004], geoIdx: 0, matIdx: 0, scale: 1.1 },
      { pos: [-14, -5, -4], rotSpeed: [-0.005, 0.007, -0.003], geoIdx: 1, matIdx: 1, scale: 0.9 },
      { pos: [13, 8, -5], rotSpeed: [0.004, -0.006, 0.005], geoIdx: 2, matIdx: 2, scale: 1.2 },
      { pos: [15, -6, -3], rotSpeed: [0.007, 0.005, -0.006], geoIdx: 0, matIdx: 1, scale: 0.8 },
      { pos: [-6, 9, -7], rotSpeed: [-0.004, -0.005, 0.007], geoIdx: 1, matIdx: 0, scale: 0.7 },
      { pos: [7, -9, -4], rotSpeed: [0.005, -0.004, 0.003], geoIdx: 2, matIdx: 2, scale: 0.95 },
    ];

    shardConfigs.forEach((cfg) => {
      const mesh = new THREE.Mesh(shardGeos[cfg.geoIdx], shardMaterials[cfg.matIdx]);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      mesh.scale.setScalar(cfg.scale);

      // Inner solid glow core for crystal
      const coreGeo = new THREE.OctahedronGeometry(0.32, 0);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      mesh.add(coreMesh);

      shards.push({
        mesh,
        rotSpeed: cfg.rotSpeed,
        baseY: cfg.pos[1],
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: 0.8 + Math.random() * 0.6,
      });
      shardsGroup.add(mesh);
    });

    parallaxGroup.add(shardsGroup);

    // ------------------------------------------------------------------------
    // Animation & Mouse Interaction Loop
    // ------------------------------------------------------------------------
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let animationFrameId = null;
    let clock = new THREE.Clock();

    const handlePointerMove = (e) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetMouseX = normX;
      targetMouseY = normY;
    };

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("resize", handleResize);

    const animate = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsedTime = clock.getElapsedTime();

      // Smooth inertia mouse parallax
      if (!prefersReducedMotion) {
        currentMouseX += (targetMouseX - currentMouseX) * 0.05;
        currentMouseY += (targetMouseY - currentMouseY) * 0.05;

        parallaxGroup.rotation.y = currentMouseX * 0.12;
        parallaxGroup.rotation.x = -currentMouseY * 0.09;
        parallaxGroup.position.x = currentMouseX * 0.8;
        parallaxGroup.position.y = currentMouseY * 0.6;
      }

      // Rotate stardust field slowly
      particles.rotation.y = elapsedTime * 0.015;
      particles.rotation.x = Math.sin(elapsedTime * 0.008) * 0.02;

      // Rotate celestial rings
      ringGroup.rotation.z = elapsedTime * 0.035;
      ring1.rotation.y = elapsedTime * 0.02;
      ring2.rotation.x = -elapsedTime * 0.025;

      // Animate floating crystal shards
      shards.forEach((s) => {
        s.mesh.rotation.x += s.rotSpeed[0];
        s.mesh.rotation.y += s.rotSpeed[1];
        s.mesh.rotation.z += s.rotSpeed[2];
        s.mesh.position.y = s.baseY + Math.sin(elapsedTime * s.floatSpeed + s.floatPhase) * 0.35;
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // ------------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------------
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);

      // Dispose Three.js objects to avoid memory leaks
      particleGeo.dispose();
      particleMat.dispose();
      particleTexture.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      shardGeos.forEach((g) => g.dispose());
      shardMaterials.forEach((m) => m.dispose());

      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="auth-3d-canvas-container"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
      }}
    />
  );
}
