import * as THREE from "three";

const BOARD_SIZE = 4;
const SHUFFLE_MOVES = 320;
const TILE_SPACING = 1.08;
const TILE_BASE_Y = 0.22;
const SOLVED_BOARD = Array.from({ length: BOARD_SIZE * BOARD_SIZE - 1 }, (_, index) => index + 1).concat(0);
const ROW_COLORS = [0xe76f51, 0xf4a261, 0x2a9d8f, 0x457b9d];

const dom = {
    canvas: document.getElementById("scene"),
    moves: document.getElementById("moves"),
    time: document.getElementById("time"),
    state: document.getElementById("state"),
    statusTitle: document.getElementById("status-title"),
    statusText: document.getElementById("status-text"),
    shuffleButton: document.getElementById("shuffle-button"),
    fallback: document.getElementById("fallback"),
};

class NumberPuzzle3D {
    constructor() {
        this.board = SOLVED_BOARD.slice();
        this.blankIndex = this.board.length - 1;
        this.tiles = new Map();
        this.meshToNumber = new Map();
        this.animations = [];
        this.moveCount = 0;
        this.startTime = performance.now();
        this.clearTime = null;
        this.isCleared = false;
        this.hoveredNumber = null;
        this.pointer = new THREE.Vector2(2, 2);
        this.pointerTilt = new THREE.Vector2();
        this.lastFrame = performance.now();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: dom.canvas,
                antialias: true,
                alpha: true,
            });
        } catch (error) {
            dom.fallback.style.display = "block";
            throw error;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x08111b, 10, 26);

        this.cameraRig = new THREE.Group();
        this.scene.add(this.cameraRig);

        this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 7.6, 8.8);
        this.camera.lookAt(0, 0, 0);
        this.cameraRig.add(this.camera);

        this.raycaster = new THREE.Raycaster();

        this.setupScene();
        this.createTiles();
        this.bindEvents();
        this.shuffleBoard();
        this.updateHud();

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupScene() {
        const ambientLight = new THREE.HemisphereLight(0xf5e6c8, 0x0a1623, 1.35);
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xfff4dd, 1.55);
        keyLight.position.set(7, 9, 5);
        this.scene.add(keyLight);

        const fillLight = new THREE.PointLight(0x5cc8ff, 18, 20, 2.2);
        fillLight.position.set(-5, 4.8, -3.5);
        this.scene.add(fillLight);

        const warmLight = new THREE.PointLight(0xff9b54, 14, 22, 2);
        warmLight.position.set(5, 3.5, 5.5);
        this.scene.add(warmLight);

        const pedestalMaterial = new THREE.MeshStandardMaterial({
            color: 0x182432,
            roughness: 0.82,
            metalness: 0.1,
        });
        const pedestal = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.44, 5.6), pedestalMaterial);
        pedestal.position.y = -0.22;
        this.scene.add(pedestal);

        const innerPlate = new THREE.Mesh(
            new THREE.BoxGeometry(5.0, 0.14, 5.0),
            new THREE.MeshStandardMaterial({
                color: 0x223244,
                roughness: 0.46,
                metalness: 0.14,
            }),
        );
        innerPlate.position.y = 0.08;
        this.scene.add(innerPlate);

        const glow = new THREE.Mesh(
            new THREE.CircleGeometry(5.8, 64),
            new THREE.MeshBasicMaterial({
                color: 0x4fc3f7,
                transparent: true,
                opacity: 0.08,
            }),
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.y = -0.26;
        this.scene.add(glow);

        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(3.5, 0.05, 16, 120),
            new THREE.MeshBasicMaterial({
                color: 0xf6bd60,
                transparent: true,
                opacity: 0.18,
            }),
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = -0.16;
        this.scene.add(halo);
    }

    createTiles() {
        for (let number = 1; number < BOARD_SIZE * BOARD_SIZE; number += 1) {
            const tile = this.buildTile(number);
            this.tiles.set(number, tile);
            this.meshToNumber.set(tile.mesh, number);
            this.scene.add(tile.group);
        }
    }

    buildTile(number) {
        const rowColor = ROW_COLORS[Math.floor((number - 1) / BOARD_SIZE)];
        const sideColor = new THREE.Color(rowColor).multiplyScalar(0.82);

        const sideMaterial = new THREE.MeshStandardMaterial({
            color: sideColor,
            roughness: 0.36,
            metalness: 0.18,
            emissive: sideColor.clone().multiplyScalar(0.1),
        });
        const topTexture = this.createTileTexture(number, rowColor);
        const topMaterial = new THREE.MeshStandardMaterial({
            map: topTexture,
            roughness: 0.22,
            metalness: 0.12,
            emissive: new THREE.Color(rowColor).multiplyScalar(0.12),
        });
        const bottomMaterial = new THREE.MeshStandardMaterial({
            color: 0x101820,
            roughness: 0.95,
            metalness: 0.02,
        });

        const geometry = new THREE.BoxGeometry(0.92, 0.36, 0.92);
        const materials = [
            sideMaterial,
            sideMaterial,
            topMaterial,
            bottomMaterial,
            sideMaterial,
            sideMaterial,
        ];

        const group = new THREE.Group();
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.position.y = TILE_BASE_Y;
        group.add(mesh);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0xf6f1e9, transparent: true, opacity: 0.42 }),
        );
        edges.position.copy(mesh.position);
        group.add(edges);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.42, 28),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.18,
            }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        shadow.scale.set(1.14, 1.14, 1.14);
        group.add(shadow);

        return {
            number,
            group,
            mesh,
            edges,
            shadow,
            hover: 0,
            hoverTarget: 0,
            jump: 0,
        };
    }

    createTileTexture(number, colorValue) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const color = new THREE.Color(colorValue);
        const rgb = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
        const dark = `rgba(0, 0, 0, 0.18)`;

        ctx.fillStyle = "#f4efe5";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, rgb);
        gradient.addColorStop(1, "#f8f1e2");
        ctx.fillStyle = gradient;
        ctx.fillRect(18, 18, canvas.width - 36, canvas.height - 36);

        ctx.fillStyle = dark;
        for (let y = 0; y < canvas.height; y += 18) {
            ctx.fillRect(18, y, canvas.width - 36, 4);
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
        ctx.lineWidth = 6;
        ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

        ctx.fillStyle = "#12202d";
        ctx.font = "bold 132px 'Gill Sans', 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(number), canvas.width / 2, canvas.height / 2 + 10);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    bindEvents() {
        window.addEventListener("resize", () => this.handleResize());
        window.addEventListener("keydown", (event) => this.handleKeyDown(event));
        dom.canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
        dom.canvas.addEventListener("pointerleave", () => this.clearPointer());
        dom.canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
        dom.shuffleButton.addEventListener("click", () => this.shuffleBoard());
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    handleKeyDown(event) {
        if (this.animations.length > 0) {
            return;
        }

        if (event.key === "r" || event.key === "R") {
            this.shuffleBoard();
            return;
        }

        let target = null;
        if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
            if (this.blankIndex % BOARD_SIZE < BOARD_SIZE - 1) {
                target = this.blankIndex + 1;
            }
        } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
            if (this.blankIndex % BOARD_SIZE > 0) {
                target = this.blankIndex - 1;
            }
        } else if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
            if (Math.floor(this.blankIndex / BOARD_SIZE) < BOARD_SIZE - 1) {
                target = this.blankIndex + BOARD_SIZE;
            }
        } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
            if (Math.floor(this.blankIndex / BOARD_SIZE) > 0) {
                target = this.blankIndex - BOARD_SIZE;
            }
        } else if ((event.key === "n" || event.key === "N") && this.isCleared) {
            this.shuffleBoard();
            return;
        }

        if (target !== null) {
            this.tryMoveIndex(target);
        }
    }

    handlePointerMove(event) {
        const rect = dom.canvas.getBoundingClientRect();
        const normalizedX = (event.clientX - rect.left) / rect.width;
        const normalizedY = (event.clientY - rect.top) / rect.height;
        this.pointer.x = normalizedX * 2 - 1;
        this.pointer.y = -(normalizedY * 2 - 1);
        this.pointerTilt.set(normalizedX - 0.5, normalizedY - 0.5);
        this.updateHoveredTile();
    }

    handlePointerDown(event) {
        if (this.animations.length > 0) {
            return;
        }

        this.handlePointerMove(event);
        if (this.hoveredNumber === null) {
            return;
        }

        const tileIndex = this.board.indexOf(this.hoveredNumber);
        this.tryMoveIndex(tileIndex);
    }

    clearPointer() {
        this.pointer.set(2, 2);
        this.pointerTilt.set(0, 0);
        this.hoveredNumber = null;
        this.tiles.forEach((tile) => {
            tile.hoverTarget = 0;
        });
    }

    updateHoveredTile() {
        if (this.animations.length > 0 || this.isCleared) {
            this.hoveredNumber = null;
            this.tiles.forEach((tile) => {
                tile.hoverTarget = 0;
            });
            return;
        }

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const meshes = Array.from(this.meshToNumber.keys());
        const hits = this.raycaster.intersectObjects(meshes, false);
        const nextNumber = hits.length > 0 ? this.meshToNumber.get(hits[0].object) : null;
        const nextIndex = nextNumber !== null ? this.board.indexOf(nextNumber) : -1;
        const movable = nextIndex >= 0 && this.getAdjacentIndices(this.blankIndex).includes(nextIndex);
        this.hoveredNumber = movable ? nextNumber : null;

        this.tiles.forEach((tile) => {
            tile.hoverTarget = tile.number === this.hoveredNumber ? 1 : 0;
        });
    }

    positionForIndex(index) {
        const row = Math.floor(index / BOARD_SIZE);
        const col = index % BOARD_SIZE;
        return new THREE.Vector3(
            (col - (BOARD_SIZE - 1) / 2) * TILE_SPACING,
            0,
            (row - (BOARD_SIZE - 1) / 2) * TILE_SPACING,
        );
    }

    getAdjacentIndices(index) {
        const row = Math.floor(index / BOARD_SIZE);
        const col = index % BOARD_SIZE;
        const adjacent = [];
        if (row > 0) {
            adjacent.push(index - BOARD_SIZE);
        }
        if (row < BOARD_SIZE - 1) {
            adjacent.push(index + BOARD_SIZE);
        }
        if (col > 0) {
            adjacent.push(index - 1);
        }
        if (col < BOARD_SIZE - 1) {
            adjacent.push(index + 1);
        }
        return adjacent;
    }

    isSolvedBoard(board) {
        return board.every((value, index) => value === SOLVED_BOARD[index]);
    }

    shuffleBoard() {
        const board = SOLVED_BOARD.slice();
        let blankIndex = board.length - 1;
        let previousBlank = -1;

        for (let step = 0; step < SHUFFLE_MOVES; step += 1) {
            let options = this.getAdjacentIndices(blankIndex).filter((index) => index !== previousBlank);
            if (options.length === 0) {
                options = this.getAdjacentIndices(blankIndex);
            }
            const chosenIndex = options[Math.floor(Math.random() * options.length)];
            board[blankIndex] = board[chosenIndex];
            board[chosenIndex] = 0;
            previousBlank = blankIndex;
            blankIndex = chosenIndex;
        }

        if (this.isSolvedBoard(board)) {
            this.shuffleBoard();
            return;
        }

        this.board = board;
        this.blankIndex = blankIndex;
        this.animations = [];
        this.hoveredNumber = null;
        this.tiles.forEach((tile) => {
            tile.hover = 0;
            tile.hoverTarget = 0;
            tile.jump = 0;
        });

        this.board.forEach((value, index) => {
            if (value === 0) {
                return;
            }
            const tile = this.tiles.get(value);
            tile.group.position.copy(this.positionForIndex(index));
        });

        this.moveCount = 0;
        this.startTime = performance.now();
        this.clearTime = null;
        this.isCleared = false;
        this.setStatus("Slide the board", "隣接するタイルを選んで空白へスライド。キーボードでは矢印キー / WASD、`R` で再シャッフルできます。");
        this.updateHud();
    }

    tryMoveIndex(index) {
        if (this.isCleared || this.animations.length > 0) {
            return false;
        }

        if (!this.getAdjacentIndices(this.blankIndex).includes(index)) {
            return false;
        }

        const tileNumber = this.board[index];
        if (tileNumber === 0) {
            return false;
        }

        const blankBeforeMove = this.blankIndex;
        this.board[this.blankIndex] = tileNumber;
        this.board[index] = 0;
        this.blankIndex = index;

        const tile = this.tiles.get(tileNumber);
        this.animations.push({
            tile,
            start: tile.group.position.clone(),
            end: this.positionForIndex(blankBeforeMove),
            elapsed: 0,
            duration: 220,
        });

        this.moveCount += 1;
        this.updateHud();
        this.updateHoveredTile();

        if (this.isSolvedBoard(this.board)) {
            this.isCleared = true;
            this.clearTime = performance.now();
            this.setStatus(
                "Solved",
                `クリアです。${String(this.moveCount).padStart(3, "0")} 手で完成しました。New Puzzle か N キーでもう一度始められます。`,
            );
            this.updateHud();
        }
        return true;
    }

    setStatus(title, text) {
        dom.statusTitle.textContent = title;
        dom.statusText.textContent = text;
    }

    elapsedSeconds() {
        const endTime = this.clearTime ?? performance.now();
        return Math.floor((endTime - this.startTime) / 1000);
    }

    updateHud() {
        dom.moves.textContent = String(this.moveCount).padStart(3, "0");
        dom.time.textContent = `${String(this.elapsedSeconds()).padStart(3, "0")}s`;
        dom.state.textContent = this.isCleared ? "CLEAR" : "PLAY";
    }

    updateAnimations(deltaMs) {
        this.animations = this.animations.filter((animation) => {
            animation.elapsed += deltaMs;
            const progress = Math.min(animation.elapsed / animation.duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            animation.tile.group.position.lerpVectors(animation.start, animation.end, eased);
            animation.tile.jump = Math.sin(progress * Math.PI) * 0.18;
            if (progress >= 1) {
                animation.tile.group.position.copy(animation.end);
                animation.tile.jump = 0;
                return false;
            }
            return true;
        });
    }

    updateTileVisuals() {
        this.tiles.forEach((tile) => {
            tile.hover += (tile.hoverTarget - tile.hover) * 0.18;
            const scale = 1 + tile.hover * 0.04;
            tile.mesh.scale.set(scale, 1, scale);
            tile.edges.scale.set(scale, 1, scale);
            tile.mesh.position.y = TILE_BASE_Y + tile.hover * 0.05 + tile.jump;
            tile.edges.position.y = tile.mesh.position.y;
            tile.shadow.material.opacity = 0.18 - tile.hover * 0.03;
        });
    }

    updateCamera() {
        this.cameraRig.rotation.y += (this.pointerTilt.x * 0.18 - this.cameraRig.rotation.y) * 0.04;
        this.cameraRig.rotation.x += (-this.pointerTilt.y * 0.08 - this.cameraRig.rotation.x) * 0.04;
    }

    animate(frameTime) {
        const deltaMs = Math.min(frameTime - this.lastFrame, 32);
        this.lastFrame = frameTime;

        this.updateAnimations(deltaMs);
        this.updateTileVisuals();
        this.updateCamera();
        this.updateHud();
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(this.animate);
    }
}

new NumberPuzzle3D();
