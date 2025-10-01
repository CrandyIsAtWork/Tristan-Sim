// Initialization function called when the script loads
document.addEventListener('DOMContentLoaded', init);

// --- Game Constants ---
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;
const TILE_WALL = { type: 'wall' };
const TILE_FLOOR = { type: 'floor' };
const TILE_EXIT = { type: 'exit' }; 
const NUM_ENEMIES = 3;
const NUM_TREASURE_NODES = 3; // New constant for rare metal nodes

// --- Game State Variables ---
const gameState = {
    map: [],
    // UPDATED: Added level and xp state
    player: { x: 0, y: 0, type: 'player', hp: 10, maxHp: 10, attack: 3, level: 1, xp: 0, xpToNextLevel: 10 },
    enemies: [],
    treasureNodes: [], // NEW: Array to hold valuable metal positions
    currentScreen: 'loading', // 'loading', 'intro', 'tutorial', 'game', 'battle'
    currentEnemy: null,
};

const battleState = {
    turnPhase: 'player_action', // 'player_action', 'enemy_action', 'end_turn'
    menuIndex: 0,
};

let raf; // Request Animation Frame reference
let inputDebounce = { up: false, down: false, left: false, right: false, select: false, gameMove: false, battleMove: false };

// --- DOM Elements (Declared as 'let' for assignment in init()) ---
// These will be assigned their values inside the init function to ensure they load correctly.
let loadingScreen, introScreen, tutorialScreen, gameArea, gameMapElement, messageLog, playerStats;
let playerHPElement, playerMaxHPElement, playerAttackElement;
let playerLevelElement, playerXPElement, playerXPNextElement; // NEW XP/Level elements

// Battle elements
let battleScreen, battleMessageLog, battlePlayerHP, battleEnemyHP, enemyNameElement, battleMenuOptions;

// Menu elements
let introOptions, tutorialOptions;

let selectedIndex = 0; // For Intro Menu
let tutorialIndex = 0; // For Tutorial Menu


// --- Utility Functions ---

function logMessage(message) {
    const p = document.createElement('p');
    p.textContent = message;
    messageLog.prepend(p);
    // Keep log short
    while (messageLog.children.length > 20) {
        messageLog.removeChild(messageLog.lastChild);
    }
}

function showScreen(screenElement) {
    loadingScreen.classList.add('hidden');
    introScreen.classList.add('hidden'); 
    tutorialScreen.classList.add('hidden'); 
    gameArea.classList.add('hidden');
    battleScreen.classList.add('hidden');

    screenElement.classList.remove('hidden');
    
    // Update currentScreen state
    if (screenElement === loadingScreen) gameState.currentScreen = 'loading';
    else if (screenElement === introScreen) gameState.currentScreen = 'intro';
    else if (screenElement === tutorialScreen) gameState.currentScreen = 'tutorial';
    else if (screenElement === gameArea) gameState.currentScreen = 'game';
    else if (screenElement === battleScreen) gameState.currentScreen = 'battle';
    
    playerStats.style.display = gameState.currentScreen === 'game' ? 'block' : 'none';
}

// --- Map Generation ---

function createMap() {
    // 1. Fill map with walls
    let map = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(TILE_WALL.type));

    // 2. Simple Room-based generation
    const numRooms = 5 + Math.floor(Math.random() * 5); // 5 to 9 rooms
    for (let i = 0; i < numRooms; i++) {
        let rw = 5 + Math.floor(Math.random() * 5); // Room width 5-9
        let rh = 5 + Math.floor(Math.random() * 5); // Room height 5-9
        let rx = 1 + Math.floor(Math.random() * (MAP_WIDTH - rw - 2));
        let ry = 1 + Math.floor(Math.random() * (MAP_HEIGHT - rh - 2));

        for (let y = ry; y < ry + rh; y++) {
            for (let x = rx; x < rx + rw; x++) {
                map[y][x] = TILE_FLOOR.type;
            }
        }
    }
    
    return map;
}

function placeEntities(map) {
    let floorTiles = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (map[y][x] === TILE_FLOOR.type) { floorTiles.push({ x, y }); }
        }
    }
    
    // 1. Place Player (at the first available tile)
    const playerPos = floorTiles.splice(Math.floor(Math.random() * floorTiles.length), 1)[0];
    gameState.player.x = playerPos.x;
    gameState.player.y = playerPos.y;

    // 2. Place Exit Tile
    if (floorTiles.length > 0) {
        const exitPos = floorTiles.splice(Math.floor(Math.random() * floorTiles.length), 1)[0];
        gameState.map[exitPos.y][exitPos.x] = TILE_EXIT.type;
        logMessage(`The certified exit awaits at (${exitPos.x}, ${exitPos.y}).`);
    }

    // 3. Place Enemies
    gameState.enemies = [];
    for (let i = 0; i < NUM_ENEMIES; i++) {
        if (floorTiles.length > 0) {
            const pos = floorTiles.splice(Math.floor(Math.random() * floorTiles.length), 1)[0];
            gameState.enemies.push({ 
                x: pos.x, 
                y: pos.y, 
                type: 'enemy-cancer-blob', 
                hp: 5, 
                maxHp: 5, 
                attack: 2,
                name: 'Cancer Blob',
                xpReward: 5 // XP granted upon defeat
            });
        }
    }

    // 4. Place Treasure Nodes (Valuable Rare Metal)
    gameState.treasureNodes = [];
    for (let i = 0; i < NUM_TREASURE_NODES; i++) {
        if (floorTiles.length > 0) {
            const pos = floorTiles.splice(Math.floor(Math.random() * floorTiles.length), 1)[0];
            gameState.treasureNodes.push({ x: pos.x, y: pos.y, type: 'rare-metal' });
        }
    }
}

function initMap() {
    gameState.map = createMap();
    placeEntities(gameState.map);
    renderMap();
}

// --- Rendering ---

function renderMap() {
    gameMapElement.style.width = `${MAP_WIDTH * 30}px`;
    gameMapElement.style.height = `${MAP_HEIGHT * 30}px`;
    let mapHTML = '';
    
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileType = gameState.map[y][x];
            let tileClasses = tileType === TILE_EXIT.type ? `${tileType} exit` : tileType;
            let tileHTML = `<div class="tile ${tileClasses}" style="left:${x*30}px; top:${y*30}px;">`;

            // Render Treasure Node (Rare Metal)
            const treasure = gameState.treasureNodes.find(t => t.x === x && t.y === y);
            if (treasure) {
                tileHTML += `<div class="entity treasure-node"></div>`; 
            }
            
            // Render Enemy
            const enemy = gameState.enemies.find(e => e.x === x && e.y === y);
            if (enemy && enemy.hp > 0) {
                tileHTML += `<div class="entity ${enemy.type}"></div>`;
            }

            // Render Player
            if (gameState.player.x === x && gameState.player.y === y) {
                tileHTML += `<div class="entity player"></div>`;
            }

            tileHTML += `</div>`;
            mapHTML += tileHTML;
        }
    }
    gameMapElement.innerHTML = mapHTML;
    updateStatsDisplay();
}

function updateStatsDisplay() {
    // Player Stats
    playerLevelElement.textContent = gameState.player.level;
    playerHPElement.textContent = gameState.player.hp;
    playerMaxHPElement.textContent = gameState.player.maxHp;
    playerAttackElement.textContent = gameState.player.attack;
    playerXPElement.textContent = gameState.player.xp;
    playerXPNextElement.textContent = gameState.player.xpToNextLevel;
}

// --- Player Movement ---

function isWalkable(x, y) {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
        return false;
    }
    return gameState.map[y][x] !== TILE_WALL.type;
}

function movePlayer(dx, dy) {
    const newX = gameState.player.x + dx;
    const newY = gameState.player.y + dy;
    
    if (isWalkable(newX, newY)) {
        
        // Check for Exit Tile
        if (gameState.map[newY][newX] === TILE_EXIT.type) {
            logMessage("Congratulations! You found the Certified Exit and escaped the dungeon!");
            showScreen(introScreen); 
            return;
        }

        // Check for Enemy Encounter
        const enemyIndex = gameState.enemies.findIndex(e => e.x === newX && e.y === newY && e.hp > 0);
        if (enemyIndex !== -1) {
            gameState.currentEnemy = gameState.enemies[enemyIndex];
            startBattle(gameState.currentEnemy);
            return;
        }
        
        // Check for Treasure Node Collection
        const treasureIndex = gameState.treasureNodes.findIndex(t => t.x === newX && t.y === newY);
        if (treasureIndex !== -1) {
            gameState.treasureNodes.splice(treasureIndex, 1); // Remove node from the map
            logMessage("You mined a chunk of rare certified metal! (No in-game effect yet!)");
        }

        // Move the player
        gameState.player.x = newX;
        gameState.player.y = newY;
        logMessage(`Tristan moved to (${newX}, ${newY}).`);
    } else {
        logMessage("A wall stops your certified path.");
    }

    renderMap();
}

// --- Leveling System ---

function checkLevelUp() {
    while (gameState.player.xp >= gameState.player.xpToNextLevel) {
        // Gain a Level!
        gameState.player.level++;
        gameState.player.xp -= gameState.player.xpToNextLevel;
        
        // Calculate next XP requirement (e.g., exponential growth)
        gameState.player.xpToNextLevel = Math.floor(gameState.player.xpToNextLevel * 1.5);
        
        // Improve stats (Certified boost!)
        gameState.player.maxHp += 3;
        gameState.player.hp = gameState.player.maxHp; // Heal to full
        gameState.player.attack += 1;
        
        logMessage(`*** TRISTAN LEVELED UP! Now Certified Level ${gameState.player.level}! ***`);
    }
}


// --- Battle Logic ---

function startBattle(enemy) {
    showScreen(battleScreen);
    battleState.turnPhase = 'player_action';
    battleState.menuIndex = 0;
    
    enemyNameElement.textContent = enemy.name;
    
    updateBattleDisplay();
    updateBattleMenuSelection();
    logBattleMessage(`A Certified ${enemy.name} blocks your path!`);
}

function updateBattleDisplay() {
    battlePlayerHP.textContent = `${gameState.player.hp} / ${gameState.player.maxHp}`;
    battleEnemyHP.textContent = `${gameState.currentEnemy.hp} / ${gameState.currentEnemy.maxHp}`;
}

function logBattleMessage(message) {
    battleMessageLog.textContent = message;
}

function updateBattleMenuSelection() {
    battleMenuOptions.forEach((item, index) => {
        item.classList.remove('selected');
        if (index === battleState.menuIndex) {
            item.classList.add('selected');
        }
    });
}

function navigateBattleMenu(direction) {
    if (battleState.turnPhase !== 'player_action') return;
    
    const len = battleMenuOptions.length;
    if (direction === 'UP' || direction === 'LEFT') {
        battleState.menuIndex = (battleState.menuIndex - 1 + len) % len;
    } else if (direction === 'DOWN' || direction === 'RIGHT') {
        battleState.menuIndex = (battleState.menuIndex + 1) % len;
    }
    updateBattleMenuSelection();
}

function executeBattleTurn(menuIndex) {
    if (battleState.turnPhase !== 'player_action') return;
    
    const action = battleMenuOptions[menuIndex].textContent;
    
    if (action === 'Attack') {
        playerAttack();
    } else {
        logBattleMessage(`${action} is not certified yet! You lose your turn.`);
        setTimeout(enemyTurn, 1000);
    }
}

function playerAttack() {
    const enemy = gameState.currentEnemy;
    const damage = gameState.player.attack;
    enemy.hp -= damage;
    logBattleMessage(`Tristan certified the ${enemy.name} for ${damage} damage!`);
    updateBattleDisplay();

    if (enemy.hp <= 0) {
        endBattle('win');
    } else {
        setTimeout(enemyTurn, 1500);
    }
}

function enemyTurn() {
    const enemy = gameState.currentEnemy;
    if (enemy.hp <= 0) return; 
    
    const damage = enemy.attack;
    gameState.player.hp -= damage;
    logBattleMessage(`${enemy.name} smacked Tristan for ${damage} damage!`);
    updateBattleDisplay();

    if (gameState.player.hp <= 0) {
        endBattle('loss');
    } else {
        // Player's turn again
        battleState.turnPhase = 'player_action';
        logBattleMessage("What will Tristan do?");
        updateBattleMenuSelection();
    }
}

function endBattle(result) {
    gameState.currentEnemy.hp = 0; // Ensure it's marked as defeated
    if (result === 'win') {
        const xpGained = gameState.currentEnemy.xpReward;
        gameState.player.xp += xpGained;
        
        logMessage(`The ${gameState.currentEnemy.name} was certified and defeated! Tristan gained ${xpGained} XP!`);
        
        checkLevelUp(); // Check if player leveled up from the new XP
        
    } else {
        logMessage(`Tristan was defeated and must restart his certified journey!`);
        // Reset player for the next game
        gameState.player.hp = gameState.player.maxHp;
    }
    
    gameState.currentEnemy = null;
    showScreen(gameArea);
    renderMap(); // Redraw map to remove defeated enemy sprite
}

// --- Menu Navigation ---

function updateMenuSelection() {
    // Update Intro Menu
    introOptions.forEach(item => item.classList.remove('selected'));
    if (gameState.currentScreen === 'intro') {
        introOptions[selectedIndex].classList.add('selected');
    }
    
    // Update Tutorial Menu
    tutorialOptions.forEach(item => item.classList.remove('selected'));
    if (gameState.currentScreen === 'tutorial') {
        tutorialOptions[tutorialIndex].classList.add('selected');
    }
}

function navigateMenu(direction) {
    if (gameState.currentScreen === 'intro') {
        selectedIndex = (selectedIndex + direction + introOptions.length) % introOptions.length;
    } else if (gameState.currentScreen === 'tutorial') {
        tutorialIndex = (tutorialIndex + direction + tutorialOptions.length) % tutorialOptions.length;
    }
    updateMenuSelection();
}

function selectMenuItem() {
    if (gameState.currentScreen === 'intro') {
        const selectedText = introOptions[selectedIndex].textContent;
        switch (selectedText) {
            case 'Start Game': startGame(); break;
            case 'View Tutorial': showScreen(tutorialScreen); tutorialIndex = 0; updateMenuSelection(); break; 
            case 'Exit': logMessage('Exiting... (Refresh page to restart)'); break;
        }
    } else if (gameState.currentScreen === 'tutorial') {
        const selectedText = tutorialOptions[tutorialIndex].textContent;
        switch (selectedText) {
            case 'Begin Certified Adventure': startGame(); break;
            case 'Back to Start Menu': showScreen(introScreen); selectedIndex = 1; updateMenuSelection(); break;
        }
    }
}


// --- Game Flow ---

function startGame() {
    // Reset player stats on game start
    gameState.player.hp = gameState.player.maxHp;
    
    initMap(); // Generate the new map and entities
    showScreen(gameArea);
    logMessage("Tristan wakes up in a Certified Dungeon.");
    logMessage("Use WASD/D-Pad to move. Find the Exit tile to escape!");
}

function init() {
    // ********* FIX: FETCH ALL DOM ELEMENTS HERE *********
    // This ensures elements are available when the script executes the rest of the logic.
    loadingScreen = document.getElementById('loading-screen');
    introScreen = document.getElementById('intro-screen');
    tutorialScreen = document.getElementById('tutorial-screen'); 
    gameArea = document.getElementById('game-area');
    gameMapElement = document.getElementById('game-map');
    messageLog = document.getElementById('message-log');
    playerStats = document.getElementById('player-stats');
    playerHPElement = document.getElementById('player-hp');
    playerMaxHPElement = document.getElementById('player-max-hp');
    playerAttackElement = document.getElementById('player-attack');
    playerLevelElement = document.getElementById('player-level'); // NEW
    playerXPElement = document.getElementById('player-xp'); // NEW
    playerXPNextElement = document.getElementById('player-xp-next'); // NEW

    // Battle elements
    battleScreen = document.getElementById('battle-screen');
    battleMessageLog = document.getElementById('battle-message-log');
    battlePlayerHP = document.getElementById('battle-player-hp');
    battleEnemyHP = document.getElementById('battle-enemy-hp');
    enemyNameElement = document.getElementById('enemy-name');
    battleMenuOptions = document.querySelectorAll('#battle-menu .menu-item');

    // Menu elements
    introOptions = document.querySelectorAll('#intro-options .menu-item'); 
    tutorialOptions = document.querySelectorAll('#tutorial-menu .tut-option'); 
    // ****************************************************
    
    // Start the game loop
    raf = window.requestAnimationFrame(gameLoop);
    
    // Show the intro screen after the loading screen delay
    setTimeout(() => {
        showScreen(introScreen); 
        updateMenuSelection();
    }, 3000); 
    
    // Setup Keyboard Input Handlers
    document.addEventListener('keydown', (event) => {
        
        if (gameState.currentScreen === 'intro' || gameState.currentScreen === 'tutorial') {
            if (event.key === 'w' || event.key === 'ArrowUp') { navigateMenu(-1); }
            else if (event.key === 's' || event.key === 'ArrowDown') { navigateMenu(1); }
            else if (event.key === 'Enter') { selectMenuItem(); }
            
        } else if (gameState.currentScreen === 'game') {
            let dx = 0; let dy = 0;
            if (event.key === 'w' || event.key === 'ArrowUp') { dy = -1; }
            else if (event.key === 's' || event.key === 'ArrowDown') { dy = 1; }
            else if (event.key === 'a' || event.key === 'ArrowLeft') { dx = -1; }
            else if (event.key === 'd' || event.key === 'ArrowRight') { dx = 1; }
            if (dx !== 0 || dy !== 0) { movePlayer(dx, dy); }

        } else if (gameState.currentScreen === 'battle') {
            if (battleState.turnPhase !== 'player_action') return;
            let direction = null;
            if (event.key === 'w' || event.key === 'ArrowUp') direction = 'UP';
            else if (event.key === 's' || event.key === 'ArrowDown') direction = 'DOWN';
            else if (event.key === 'a' || event.key === 'ArrowLeft') direction = 'LEFT';
            else if (event.key === 'd' || event.key === 'ArrowRight') direction = 'RIGHT';

            if (direction) { 
                navigateBattleMenu(direction); 
            } else if (event.key === 'Enter') { 
                executeBattleTurn(battleState.menuIndex); 
            }
        }
    });
}

// --- Gamepad Loop ---
function gameLoop() {
    const gamepad = navigator.getGamepads()[0]; 
    if (gamepad) {
        
        // SNES D-PAD AXIS CHECK (iNNEXT-specific logic)
        // Axes are usually -1 (left/up) to 1 (right/down)
        const axisX = gamepad.axes[0]; // Left/Right movement
        const axisY = gamepad.axes[1]; // Up/Down movement
        const axisThreshold = 0.5;

        const axisDpadUp = axisY < -axisThreshold;
        const axisDpadDown = axisY > axisThreshold;
        const axisDpadLeft = axisX < -axisThreshold;
        const axisDpadRight = axisX > axisThreshold;
        
        // BUTTON CHECK (Standard D-pad buttons 12-15)
        const buttonDpadUp = gamepad.buttons[12] && gamepad.buttons[12].pressed;
        const buttonDpadDown = gamepad.buttons[13] && gamepad.buttons[13].pressed;
        const buttonDpadLeft = gamepad.buttons[14] && gamepad.buttons[14].pressed;
        const buttonDpadRight = gamepad.buttons[15] && gamepad.buttons[15].pressed;

        // Combine D-pad checks (Axis wins if pressed)
        const dpadUp = axisDpadUp || buttonDpadUp;
        const dpadDown = axisDpadDown || buttonDpadDown;
        const dpadLeft = axisDpadLeft || buttonDpadLeft;
        const dpadRight = axisDpadRight || buttonDpadRight;
        
        // Select Button (A/B on SNES often map to 0 and 1)
        const selectButton = (gamepad.buttons[0] && gamepad.buttons[0].pressed) || 
                             (gamepad.buttons[1] && gamepad.buttons[1].pressed); 
        
        // --- GAME LOGIC ---

        // Handle Intro and Tutorial Screens
        if (gameState.currentScreen === 'intro' || gameState.currentScreen === 'tutorial') {
            if (dpadUp && !inputDebounce.up) { navigateMenu(-1); inputDebounce.up = true; } else if (!dpadUp) { inputDebounce.up = false; }
            if (dpadDown && !inputDebounce.down) { navigateMenu(1); inputDebounce.down = true; } else if (!dpadDown) { inputDebounce.down = false; }
            if (selectButton && !inputDebounce.select) { selectMenuItem(); inputDebounce.select = true; } else if (!selectButton) { inputDebounce.select = false; }
            
        } else if (gameState.currentScreen === 'game') {
            let dx = 0; let dy = 0; let moved = false;
            // Debounce for single-step movement in the game screen
            if (!inputDebounce.gameMove) {
                // Priority: Up/Down, then Left/Right
                if (dpadUp) { dy = -1; moved = true; } else if (dpadDown) { dy = 1; moved = true; }
                else if (dpadLeft) { dx = -1; moved = true; } else if (dpadRight) { dx = 1; moved = true; }
                
                if (moved) { movePlayer(dx, dy); inputDebounce.gameMove = true; }
            } 
            // Only release debounce when all D-pad inputs are lifted
            else if (!dpadUp && !dpadDown && !dpadLeft && !dpadRight) { inputDebounce.gameMove = false; }
            
        } else if (gameState.currentScreen === 'battle') {
            // Debounce for single-step menu navigation or selection in battle
            if (battleState.turnPhase === 'player_action') {
                if (!inputDebounce.battleMove) {
                    let direction = null;
                    if (dpadUp) direction = 'UP'; else if (dpadDown) direction = 'DOWN';
                    else if (dpadLeft) direction = 'LEFT'; else if (dpadRight) direction = 'RIGHT';

                    if (direction) { navigateBattleMenu(direction); inputDebounce.battleMove = true; }
                    else if (selectButton) { executeBattleTurn(battleState.menuIndex); inputDebounce.battleMove = true; }
                } 
                // Only release debounce when all D-pad inputs and select are lifted
                else if (!dpadUp && !dpadDown && !dpadLeft && !dpadRight && !selectButton) {
                    inputDebounce.battleMove = false;
                }
            }
        }
    }
    raf = window.requestAnimationFrame(gameLoop);
}
