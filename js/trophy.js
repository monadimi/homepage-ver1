// js/trophy.js

class TrophyScene {
  constructor() {
    this.container = document.getElementById('trophy-container');
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.trophyGroup = null;

    this.init();
    this.createTrophy();
    this.addLighting();
    this.animate();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('scroll', () => this.onScroll());
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();

    // Camera setup
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.z = 8;
    this.camera.position.y = 1;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.container.appendChild(this.renderer.domElement);
  }

  createTrophy() {
    this.trophyGroup = new THREE.Group();

    // Materials - Highly reflective Gold
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Gold
      metalness: 1.0,
      roughness: 0.15,
      emissive: 0x442200,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide
    });

    const darkGoldMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8860b, // DarkGoldenRod
      metalness: 0.9,
      roughness: 0.3
    });

    // 1. Base (Multiple stacked cylinders for a pedestal look)
    const baseGeo1 = new THREE.CylinderGeometry(1.6, 1.8, 0.3, 64);
    const base1 = new THREE.Mesh(baseGeo1, darkGoldMaterial);
    base1.position.y = -2.0;
    base1.receiveShadow = true;
    this.trophyGroup.add(base1);

    const baseGeo2 = new THREE.CylinderGeometry(1.4, 1.6, 0.4, 64);
    const base2 = new THREE.Mesh(baseGeo2, goldMaterial);
    base2.position.y = -1.65;
    base2.receiveShadow = true;
    this.trophyGroup.add(base2);

    const baseGeo3 = new THREE.CylinderGeometry(0.8, 1.2, 0.5, 64);
    const base3 = new THREE.Mesh(baseGeo3, goldMaterial);
    base3.position.y = -1.2;
    base3.receiveShadow = true;
    this.trophyGroup.add(base3);

    // 2. Stem/Column (Lathe for curvature)
    const stemPoints = [];
    for (let i = 0; i < 10; i++) {
      const x = 0.3 + Math.sin(i * 0.5) * 0.15;
      const y = (i * 0.15);
      stemPoints.push(new THREE.Vector2(x, y));
    }
    const stemGeo = new THREE.LatheGeometry(stemPoints, 32);
    const stem = new THREE.Mesh(stemGeo, goldMaterial);
    stem.position.y = -0.95;
    stem.scale.set(1, 1.5, 1);
    stem.castShadow = true;
    stem.receiveShadow = true;
    this.trophyGroup.add(stem);

    // 3. Cup Body (Lathe Geometry for the bowl shape)
    const cupPoints = [];
    // Define the profile of the cup
    cupPoints.push(new THREE.Vector2(0.4, 0)); // Bottom attachment
    cupPoints.push(new THREE.Vector2(0.8, 0.5));
    cupPoints.push(new THREE.Vector2(1.2, 1.5));
    cupPoints.push(new THREE.Vector2(1.5, 2.5)); // Widest part
    cupPoints.push(new THREE.Vector2(1.6, 2.8)); // Rim
    cupPoints.push(new THREE.Vector2(1.5, 2.8)); // Rim thickness inner
    cupPoints.push(new THREE.Vector2(1.4, 2.5)); // Inner curve downward

    const cupGeo = new THREE.LatheGeometry(cupPoints, 64);
    const cup = new THREE.Mesh(cupGeo, goldMaterial);
    cup.position.y = 0.0;
    cup.castShadow = true;
    cup.receiveShadow = true;
    this.trophyGroup.add(cup);

    // 4. Handles (Torus Geometry)
    const handleGeo = new THREE.TorusGeometry(0.7, 0.1, 16, 64, Math.PI);

    // Left Handle
    const leftHandle = new THREE.Mesh(handleGeo, goldMaterial);
    leftHandle.position.set(-1.3, 1.5, 0);
    leftHandle.rotation.z = Math.PI / 2; // Vertical loop
    leftHandle.rotation.y = Math.PI / 8; // Slight tilt
    leftHandle.castShadow = true;
    this.trophyGroup.add(leftHandle);

    // Right Handle
    const rightHandle = new THREE.Mesh(handleGeo, goldMaterial);
    rightHandle.position.set(1.3, 1.5, 0);
    rightHandle.rotation.z = -Math.PI / 2;
    rightHandle.rotation.y = -Math.PI / 8;
    rightHandle.castShadow = true;
    this.trophyGroup.add(rightHandle);

    // Add to scene
    this.scene.add(this.trophyGroup);

    // Tilt the whole trophy slightly for better initial angle
    this.trophyGroup.rotation.x = 0.1;
  }

  addLighting() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Main Spot Light (Simulating studio light)
    const spotLight = new THREE.SpotLight(0xfffaed, 2.0);
    spotLight.position.set(5, 10, 8);
    spotLight.angle = 0.5;
    spotLight.penumbra = 0.3;
    spotLight.decay = 2;
    spotLight.distance = 50;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    this.scene.add(spotLight);

    // Rim Light (Blue-ish back light for "Cyber" feel)
    const rimLight = new THREE.PointLight(0x0088ff, 2.0);
    rimLight.position.set(-5, 5, -5);
    this.scene.add(rimLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0xffd700, 0.5);
    fillLight.position.set(-5, 0, 5);
    this.scene.add(fillLight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.trophyGroup) {
      // Gentle idle float
      this.trophyGroup.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onScroll() {
    if (!this.trophyGroup) return;

    const scrollY = window.scrollY;
    // Rotation based on scroll position
    const rotationSpeed = 0.005;
    this.trophyGroup.rotation.y = scrollY * rotationSpeed;
  }

  onResize() {
    if (!this.container || !this.camera || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TrophyScene();
});
