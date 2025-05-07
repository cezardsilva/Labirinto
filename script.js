// Configurações do jogo
const config = {
    cellSize: 20,
    initialRows: 10,
    initialCols: 10,
    timePerLevel: 30,
    scorePerLevel: 10
};

// Estado do jogo
const gameState = {
    score: 0,
    level: 1,
    timeLeft: config.timePerLevel,
    timer: null,
    isDrawing: false,
    path: [],
    maze: null,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
    playerPos: { x: 0, y: 0 },
    reachedEnd: false,
    gameStarted: false,
    isPaused: false,
    timeWhenPaused: 0
};  // ← Fechamento correto do objeto

let joystickActive = true;
console.log("Joystick ativado");
let gamepadConnected = false;
let gamepadIndex = null;
const AXIS_CONFIG = {
    horizontal: 0,
    vertical: 1
};
const JOYSTICK_THRESHOLD = 0.5;
const JOYSTICK_UPDATE_INTERVAL = 100; // ms

let lastPlayerPosCheck = { x: -1, y: -1 };
let positionCheckInterval;
const INACTIVITY_CHECK_INTERVAL = 500; // Verifica a cada 0.5 segundos

let lastGamepadButtonState = Array(18).fill(false); // Assumindo 16 botões


// Elementos do DOM
const canvas = document.getElementById('maze');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const timerElement = document.getElementById('timer');
const restartButton = document.getElementById('restart-btn');
const fullscreenButton = document.getElementById('fullscreen');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const endScreen = document.getElementById('end-screen');
const endMessage = document.getElementById('end-message');
const endScore = document.getElementById('end-score');
const restartEndButton = document.getElementById('restart-end-button');
const pauseBtn = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const saveOverlay = document.getElementById('save-overlay');
const loadOverlay = document.getElementById('load-overlay');
const closeSaveBtn = document.getElementById('close-save-btn');
const closeLoadBtn = document.getElementById('close-load-btn');
const loadMessage = document.getElementById('load-message');

const startBarContainer = document.getElementById('start-bar-container');
const startBar = document.getElementById('start-bar');
let animationFrame = null;
let startTimeLeft = 10;
let countdownActive = false;

// Elementos do DOM para o novo overlay
const confirmSaveOverlay = document.getElementById('confirm-save-overlay');
const confirmSaveBtn = document.getElementById('confirm-save-btn');
const cancelSaveBtn = document.getElementById('cancel-save-btn');

const buttons = [
    document.getElementById('restart-btn'),
    document.getElementById('fullscreen'),
    document.getElementById('pause-btn'),
    document.getElementById('save-btn'),
    document.getElementById('load-btn')
];

let currentButtonIndex = 0;
buttons[currentButtonIndex].focus();

// Adicione estas variáveis no início, com as outras declarações
let lastMoveTime = 0;
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5000; // 5 segundos

// Inicialização
function init() {
    // Garante que o canvas tenha um tamanho inicial
    resizeCanvas();

    // Carrega e exibe o recorde
    updateHighScoreDisplay();

    // Ativa o joystick automaticamente
    startGamepadMonitoring();

    // Configura eventos
    window.addEventListener('resize', resizeCanvas);
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', resetPath);
    fullscreenButton.addEventListener('click', toggleFullscreen);
    restartEndButton.addEventListener('click', resetGame);
    pauseBtn.addEventListener('click', pauseGame);
    resumeBtn.addEventListener('click', resumeGame);
    saveBtn.addEventListener('click', saveGame);
    loadBtn.addEventListener('click', loadGame);
    closeSaveBtn.addEventListener('click', () => saveOverlay.style.display = 'none');
    closeLoadBtn.addEventListener('click', () => loadOverlay.style.display = 'none');

    document.addEventListener('keydown', (e) => {
        if (confirmSaveOverlay.style.display === 'flex') {
            // Navegação nos botões de confirmação
            if (e.key === 'ArrowLeft') {
                document.getElementById('confirm-save-btn').focus();
            } else if (e.key === 'ArrowRight') {
                document.getElementById('cancel-save-btn').focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                document.activeElement.click();
            }
            return;
        }

        // Navegação normal nos botões
        switch (e.key) {
            case 'ArrowUp':
                currentButtonIndex = (currentButtonIndex - 1 + buttons.length) % buttons.length;
                buttons[currentButtonIndex].focus();
                e.preventDefault();
                break;
            case 'ArrowDown':
                currentButtonIndex = (currentButtonIndex + 1) % buttons.length;
                buttons[currentButtonIndex].focus();
                e.preventDefault();
                break;
            case 'Enter':
            case ' ':
                buttons[currentButtonIndex].click();
                e.preventDefault();
                break;
        }
    });

    // Esconde elementos de jogo no início
    restartButton.style.display = 'none';
    document.getElementById('maze-container').style.display = 'none';


    fullscreenButton.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Erro ao tentar entrar em tela cheia: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });

    console.log("Jogo inicializado e pronto para começar");
}

// Função para ativar/desativar o joystick
function toggleJoystick() {
    joystickActive = !joystickActive;
    document.getElementById('joystick-btn').textContent =
        joystickActive ? 'Joystick Ligado' : 'Joystick Desligado';

    if (joystickActive) {
        startGamepadMonitoring();
    } else {
        stopGamepadMonitoring();
    }

    console.log("Joystick " + (joystickActive ? "ativado" : "desativado"));
}

function monitorPlayerPosition() {
    // Limpa verificação anterior
    if (positionCheckInterval) clearInterval(positionCheckInterval);

    // Inicia novo monitoramento
    positionCheckInterval = setInterval(() => {
        if (gameState.isPaused || gameState.reachedEnd || !gameState.gameStarted) return;

        const currentPos = gameState.playerPos;

        // Se posição não mudou E jogador já começou
        if (currentPos.x === lastPlayerPosCheck.x &&
            currentPos.y === lastPlayerPosCheck.y &&
            gameState.path.length > 0) {

            // Mostra barra se não estiver visível
            if (!countdownActive) {
                startVisualCountdown();
            }
        }
        // Se posição mudou, esconde a barra
        else if (countdownActive) {
            countdownActive = false;
            startBarContainer.style.display = 'none';
        }

        // Atualiza última posição verificada
        lastPlayerPosCheck = { ...currentPos };
    }, INACTIVITY_CHECK_INTERVAL);
}

// Iniciar monitoramento do gamepad
function startGamepadMonitoring() {
    if (!joystickActive) return;

    // Verifica se já temos um gamepad conectado
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            gamepadIndex = i;
            break;
        }
    }

    // Configura o intervalo para verificar o gamepad
    gamepadInterval = setInterval(updateFromGamepad, JOYSTICK_UPDATE_INTERVAL);

    // Inicia monitoramento da posição do jogador
    monitorPlayerPosition();
}

// Parar monitoramento do gamepad
function stopGamepadMonitoring() {
    clearInterval(gamepadInterval);
    gamepadIndex = null;
}

function checkPauseControls() {
    if (!gameState.isPaused || !gamepadConnected) return;

    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (!gamepad) return;

    // Botão 7 (START) - Retomar jogo
    if (gamepad.buttons[7]?.pressed && !lastGamepadButtonState[7]) {
        resumeGame();
    }

    // Atualiza estado dos botões
    lastGamepadButtonState[7] = gamepad.buttons[7]?.pressed || false;
}


// Atualizar posição do jogador com base no gamepad
function updateFromGamepad() {

    if (!joystickActive) return;

    // Controles específicos da tela de pausa
    if (gameState.isPaused) {
        checkPauseControls();
        return; // Sai da função para não processar outros controles
    }

    // Controles normais do jogo (quando não pausado)
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (!gamepad || gameState.reachedEnd) return;

    // Controles do jogador no labirinto (direcional esquerdo)
    const axes = gamepad.axes;
    let moved = false;
    let newPos = { ...gameState.playerPos };

    // Movimento horizontal (direcional esquerdo)
    if (Math.abs(axes[AXIS_CONFIG.horizontal]) > JOYSTICK_THRESHOLD) {
        newPos.x += Math.sign(axes[AXIS_CONFIG.horizontal]);
        moved = true;
    }

    // Movimento vertical (direcional esquerdo)
    if (Math.abs(axes[AXIS_CONFIG.vertical]) > JOYSTICK_THRESHOLD) {
        newPos.y += Math.sign(axes[AXIS_CONFIG.vertical]);
        moved = true;
    }

    if (moved && isValidPosition(newPos)) {
        if (gameState.path.length === 0) {
            gameState.path = [gameState.start];
            gameState.playerPos = { ...gameState.start };
            startTimer();
        }

        gameState.path.push(newPos);
        gameState.playerPos = newPos;
        checkEndReached();
        drawMaze();
    }

    // Verifica mudanças de estado dos botões
    for (let i = 0; i < gamepad.buttons.length; i++) {
        const pressed = gamepad.buttons[i]?.pressed || false;

        // Só executa ação no momento do pressionamento (não enquanto segura)
        if (pressed && !lastGamepadButtonState[i]) {
            handleGamepadButtonPress(i);
        }

        lastGamepadButtonState[i] = pressed;
    }
}

// Variável para controlar o estado da tela cheia
let isHandlingFullscreen = false;

function handleGamepadButtonPress(buttonIndex) {
    // Verificação adicional de estado
    if (!gamepadConnected || gameState.reachedEnd) return;

    // Debug detalhado
    console.log('Botão pressionado - Estado atual:', {
        button: buttonIndex,
        isPaused: gameState.isPaused,
        gameStarted: gameState.gameStarted,
        timerExists: !!gameState.timer
    });

    const currentScreen = getCurrentScreen();
    console.log(`[CONTROLE] Botão ${buttonIndex} (${getButtonName(buttonIndex)}) - Tela: ${currentScreen}`);

    // 1. TELA INICIAL
    if (currentScreen === "Início") {
        switch (buttonIndex) {
            case 7: // START - Iniciar jogo
                console.log("Iniciando jogo com START");
                simulateClick(resumeBtn);
                break;

            case 0: // TRIÂNGULO - Navegação (caso tenha outros elementos)
            case 17: // X - Navegação
                navigateButtons(buttonIndex === 0 ? -1 : 1);
                break;

            case 9: // R3 - Forçar início (fallback)
                simulateClick(startButton);
                break;
        }
        return;
    }

    // 2. DURANTE O JOGO (ATIVO)
    if (currentScreen === "Jogo Ativo") {
        switch (buttonIndex) {
            case 7: // START - Pausar/Despausar
                if (!gameState.reachedEnd) {
                    gameState.isPaused ? resumeGame() : pauseGame();
                }
                break;

            case 9: // R3 - Ação principal (equivale a Enter)
                if (!gameState.isPaused) {
                    simulateClick(buttons[currentButtonIndex]);
                }
                break;

            case 0: // TRIÂNGULO - Navegação para cima
                navigateButtons(-1);
                break;

            case 17: // X - Navegação para baixo
                navigateButtons(1);
                break;

            case 3: // Botão Círculo - "Sim, salvar"
                document.getElementById('confirm-save-btn').focus();
                document.getElementById('confirm-save-btn').click();
                break;
            case 1: // Botão Quadrado - "Cancelar"
                document.getElementById('cancel-save-btn').focus();
                document.getElementById('cancel-save-btn').click();
                break;
        }
        return;
    }

    // 3. TELA DE PAUSA
    if (!gamepadConnected) return;

    console.log("Botão do gamepad pressionado:", {
        buttonIndex,
        currentScreen: getCurrentScreen(),
        gameState: {
            isPaused: gameState.isPaused,
            gameStarted: gameState.gameStarted
        }
    });

    // Controle especial para a tela de pausa
    if (getCurrentScreen() === "Pausa") {
        console.log("Processando comando na tela de pausa");

        switch (buttonIndex) {
            case 7: // START
            case 9: // R3
                console.log("Executando resumeGame via botão do gamepad");
                resumeGame();

                // Força um redraw imediato
                drawMaze();
                break;

            case 0: // TRIÂNGULO
            case 17: // X
                navigatePauseMenu(buttonIndex === 0 ? -1 : 1);
                break;

            case 1: // QUADRADO
                if (confirm("Voltar ao menu principal?")) {
                    resetGame();
                }
                break;
        }
        return;
    }

    // 4. TELA DE FIM DE JOGO
    if (currentScreen === "Fim de Jogo") {
        switch (buttonIndex) {
            case 7: // START - Reiniciar
                simulateClick(restartEndButton);
                break;

            case 9: // R3 - Confirmar
                simulateClick(restartEndButton);
                break;

            case 0: // TRIÂNGULO - Navegação (caso tenha opções)
            case 17: // X - Navegação
                navigateEndScreen(buttonIndex === 0 ? -1 : 1);
                break;
        }
        return;
    }

    // 5. OUTRAS TELAS (SAVE/LOAD/CONFIRMAÇÃO)
    if (currentScreen.includes("Confirmação")) {
        switch (buttonIndex) {
            case 3: // CÍRCULO - Confirmar
                simulateClick(document.querySelector('#confirm-save-btn, #confirm-load-btn'));
                break;

            case 1: // QUADRADO - Cancelar
                simulateClick(document.querySelector('#cancel-save-btn, #cancel-load-btn'));
                break;

            case 7: // START - Forçar cancelamento
                simulateClick(document.querySelector('#cancel-save-btn, #cancel-load-btn'));
                break;
        }
    }
}

// FUNÇÕES AUXILIARES COMPLETAS
function getButtonName(buttonIndex) {
    const buttonNames = {
        0: "TRIÂNGULO",
        1: "QUADRADO",
        2: "X",
        3: "CÍRCULO",
        4: "L1",
        5: "R1",
        6: "L2",
        7: "START",
        8: "SELECT",
        9: "R3",
        10: "L3",
        17: "X" // Alguns controles usam 17 para X
    };
    return buttonNames[buttonIndex] || `Botão ${buttonIndex}`;
}

function navigatePauseMenu(direction) {
    const buttons = Array.from(document.querySelectorAll('#pause-overlay button'));
    if (buttons.length === 0) return;

    let currentIndex = buttons.findIndex(btn => btn === document.activeElement);
    if (currentIndex === -1) currentIndex = 0;

    const newIndex = (currentIndex + direction + buttons.length) % buttons.length;
    buttons[newIndex].focus();
}

function navigateEndScreen(direction) {
    const buttons = Array.from(document.querySelectorAll('#end-screen button'));
    if (buttons.length > 1) { // Se tiver múltiplos botões
        let currentIndex = buttons.findIndex(btn => btn === document.activeElement);
        if (currentIndex === -1) currentIndex = 0;

        const newIndex = (currentIndex + direction + buttons.length) % buttons.length;
        buttons[newIndex].focus();
    }
}

function simulateClick(element) {
    if (!element) return;

    // Cria eventos completos de mouse
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Força o foco visual
    element.focus();
    console.log(`[AÇÃO] Clicado: ${element.id || element.textContent}`);
}

// Adicione este código após a inicialização do jogo:
function forceDisplayUpdate() {
    const elements = [startScreen, pauseOverlay, endScreen, document.getElementById('maze-container')];
    elements.forEach(el => {
        el.style.display = window.getComputedStyle(el).display;
    });
}

function getCurrentScreen() {
    if (startScreen.style.display === 'flex' || startScreen.style.display === '') {
        return "Início";
    }
    if (pauseOverlay.style.display === 'flex') {
        return "Pausa";
    }
    if (endScreen.style.display === 'flex') {
        return "Fim de Jogo";
    }
    if (document.getElementById('maze-container').style.display === 'block' ||
        document.getElementById('maze-container').style.display === '') {
        return "Jogo Ativo";
    }
    return "Desconhecida";
}
function simulateClick(element) {
    const mouseEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    element.dispatchEvent(mouseEvent);
}

function navigateButtons(direction) {
    currentButtonIndex = (currentButtonIndex + direction + buttons.length) % buttons.length;
    buttons[currentButtonIndex].focus();
    console.log(`Navegou para: ${buttons[currentButtonIndex].id}`);
}


window.addEventListener("gamepadconnected", (e) => {
    gamepadIndex = e.gamepad.index;
    gamepadConnected = true;
    console.log(`Controle conectado: ${e.gamepad.id} - Índice: ${gamepadIndex}`);
    startGamepadMonitoring();
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === gamepadIndex) {
        gamepadConnected = false;
        gamepadIndex = null;
        console.log("Controle desconectado");
    }
});

// Iniciar o jogo
function startGame() {
    gameState.gameStarted = true;
    startScreen.style.display = 'none';
    restartButton.style.display = 'block';
    document.getElementById('maze-container').style.display = 'block';

    // Reseta o estado do jogo
    gameState.score = 0;
    gameState.level = 1;
    gameState.timeLeft = config.timePerLevel;
    gameState.path = [];
    gameState.reachedEnd = false;
    gameState.isPaused = false;

    updateUI();
    generateMaze();

    // ADICIONE ESTA LINHA PARA CONFIGURAR OS EVENTOS DE DESENHO
    setupDrawingEvents();

    // Inicia a contagem regressiva visual
    startVisualCountdown();

    startPositionMonitoring(); // Adicione no final da função startGame()
}

// Função apenas para a animação visual (não bloqueia o jogo)
function startVisualCountdown() {
    // Limpa o timer de inatividade
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }

    startTimeLeft = 10;
    countdownActive = true;
    startBarContainer.style.display = 'block';
    startBar.style.width = '100%';

    let lastUpdate = Date.now();

    function updateBar() {
        // Se o jogador voltou a se mover, cancela a contagem
        if (!countdownActive || gameState.isDrawing) {
            startBarContainer.style.display = 'none';
            return;
        }

        const now = Date.now();
        const delta = now - lastUpdate;

        if (delta >= 100) {
            startTimeLeft -= 0.1;
            const percent = startTimeLeft / 10 * 100;
            startBar.style.width = `${percent}%`;
            lastUpdate = now;
        }

        if (startTimeLeft <= 0) {
            countdownActive = false;
            startBarContainer.style.display = 'none';

            // Gera um novo labirinto (mesmo nível)
            generateMaze();

            // Reseta o caminho
            gameState.path = [];
            gameState.playerPos = { ...gameState.start };

            // Reinicia a contagem visual
            startVisualCountdown();
        } else {
            animationFrame = requestAnimationFrame(updateBar);
        }
    }

    animationFrame = requestAnimationFrame(updateBar);
}

// Função para pausar o jogo
function pauseGame() {
    if (gameState.reachedEnd) return;

    gameState.isPaused = true;
    gameState.timeWhenPaused = gameState.timeLeft;
    clearInterval(gameState.timer);
    pauseOverlay.style.display = 'flex';
    resumeBtn.focus();

    // Garante que o gamepad continua sendo monitorado
    if (!gamepadInterval) {
        gamepadInterval = setInterval(updateFromGamepad, JOYSTICK_UPDATE_INTERVAL);
    }
}


// Modifiqui a função resumeGame para reiniciar o timer de inatividade
function resumeGame() {
    console.log("Tentando retomar o jogo - Estado atual:", {
        isPaused: gameState.isPaused,
        gameStarted: gameState.gameStarted
    });

    if (!gameState.isPaused || !gameState.gameStarted) return;

    // Restauração do estado
    gameState.isPaused = false;
    gameState.timeLeft = gameState.timeWhenPaused;

    // Atualização visual imediata
    pauseOverlay.style.display = 'none';
    canvas.style.pointerEvents = 'auto';

    // Reinício seguro do timer
    if (!gameState.timer && gameState.timeLeft > 0) {
        startTimer();
    }

    console.log("Jogo retomado com sucesso. Novo estado:", {
        isPaused: gameState.isPaused,
        timeLeft: gameState.timeLeft,
        timerExists: !!gameState.timer
    });

    // Força redraw
    drawMaze();
}

// Função para salvar o jogo
function saveGame() {
    if (!gameState.gameStarted || gameState.isPaused) return;

    // Mostra o overlay de confirmação
    confirmSaveOverlay.style.display = 'flex';

    // Adicione eventos para os novos botões
    confirmSaveBtn.addEventListener('click', () => {
        // Esconde o overlay de confirmação
        confirmSaveOverlay.style.display = 'none';

        // Executa o salvamento real
        const savedGame = {
            level: gameState.level,
            score: gameState.score,
            timeLeft: gameState.timeLeft,
            maze: gameState.maze,
            start: gameState.start,
            end: gameState.end,
            playerPos: gameState.playerPos
        };

        localStorage.setItem('mazeSavedGame', JSON.stringify(savedGame));

        // Mostra o overlay de salvamento concluído
        saveOverlay.style.display = 'flex';

        // Esconde o overlay após 2 segundos
        setTimeout(() => {
            saveOverlay.style.display = 'none';
        }, 2000);

        console.log(`Jogo salvo no nível ${gameState.level}`);
    });

    cancelSaveBtn.addEventListener('click', () => {
        // Esconde o overlay de confirmação sem salvar
        confirmSaveOverlay.style.display = 'none';
        console.log("Salvamento cancelado pelo usuário");
    });


    localStorage.setItem('mazeSavedGame', JSON.stringify(savedGame));

    // Mostra o overlay de salvamento
    saveOverlay.style.display = 'flex';

    // Esconde o overlay após 2 segundos
    setTimeout(() => {
        saveOverlay.style.display = 'none';
    }, 2000);

    console.log(`Jogo salvo no nível ${gameState.level}`);
}

// Função para carregar o jogo
function loadGame() {
    if (!gameState.gameStarted || gameState.isPaused) return;

    const savedGame = localStorage.getItem('mazeSavedGame');
    if (savedGame) {
        const loadedGame = JSON.parse(savedGame);

        gameState.level = loadedGame.level;
        gameState.score = loadedGame.score;
        gameState.timeLeft = loadedGame.timeLeft;
        gameState.maze = loadedGame.maze;
        gameState.start = loadedGame.start;
        gameState.end = loadedGame.end;
        gameState.playerPos = loadedGame.playerPos;
        gameState.path = [];
        gameState.reachedEnd = false;

        // Limpa o timer existente
        if (gameState.timer) {
            clearInterval(gameState.timer);
            gameState.timer = null;
        }

        updateUI();
        drawMaze();

        // Mostra o overlay de carregamento
        loadMessage.textContent = `Jogo carregado no nível ${gameState.level}!`;
        loadOverlay.style.display = 'flex';

        // Esconde o overlay após 2 segundos
        setTimeout(() => {
            loadOverlay.style.display = 'none';
        }, 2000);

        console.log(`Jogo carregado no nível ${gameState.level}`);
    } else {
        loadMessage.textContent = "Nenhum jogo salvo encontrado!";
        loadOverlay.style.display = 'flex';

        // Esconde o overlay após 2 segundos
        setTimeout(() => {
            loadOverlay.style.display = 'none';
        }, 2000);

        console.log("Tentativa de carregar jogo, mas nenhum salvo encontrado");
    }
}

// Configurar eventos de desenho
function setupDrawingEvents() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
}

// Redimensionar canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gameState.gameStarted && gameState.maze) {
        drawMaze();
    }
}

function isMazeValid() {
    // Verifica as posições adjacentes à entrada
    const start = gameState.start;
    const end = gameState.end;

    // Verificação para a entrada (verde)
    const startAdjacentWalls = [
        { x: start.x, y: start.y - 1 }, // acima
        { x: start.x, y: start.y + 1 }, // abaixo
        { x: start.x - 1, y: start.y }, // esquerda
        { x: start.x + 1, y: start.y }  // direita
    ].filter(pos =>
        pos.x >= 0 && pos.y >= 0 &&
        pos.x < gameState.maze[0].length &&
        pos.y < gameState.maze.length
    ).filter(pos => gameState.maze[pos.y][pos.x] === 1).length;

    // Verificação para a saída (azul)
    const endAdjacentWalls = [
        { x: end.x, y: end.y - 1 }, // acima
        { x: end.x, y: end.y + 1 }, // abaixo
        { x: end.x - 1, y: end.y }, // esquerda
        { x: end.x + 1, y: end.y }  // direita
    ].filter(pos =>
        pos.x >= 0 && pos.y >= 0 &&
        pos.x < gameState.maze[0].length &&
        pos.y < gameState.maze.length
    ).filter(pos => gameState.maze[pos.y][pos.x] === 1).length;

    // Se tiver mais que 2 paredes adjacentes em qualquer ponto, é inválido
    return startAdjacentWalls <= 2 && endAdjacentWalls <= 2;
}

// Gerar labirinto
function generateMaze() {
    const rows = Math.min(50, config.initialRows + gameState.level * 2);
    const cols = Math.min(50, config.initialCols + gameState.level * 2);

    let maze;
    let isValid = false;
    let attempts = 0;
    const maxAttempts = 100;

    do {
        attempts++;
        isValid = true;

        // Inicializar matriz do labirinto (1 = parede, 0 = caminho)
        maze = Array(rows).fill().map(() => Array(cols).fill(1));

        // Criar paredes externas (bordas)
        for (let i = 0; i < rows; i++) {
            maze[i][0] = 2;
            maze[i][cols - 1] = 2;
        }
        for (let j = 0; j < cols; j++) {
            maze[0][j] = 2;
            maze[rows - 1][j] = 2;
        }

        // Gerar labirinto interno usando algoritmo de backtracking
        const stack = [];
        const startRow = 1 + Math.floor(Math.random() * (rows - 2));
        const startCol = 1 + Math.floor(Math.random() * (cols - 2));

        maze[startRow][startCol] = 0;
        stack.push([startRow, startCol]);

        while (stack.length > 0) {
            const [row, col] = stack[stack.length - 1];
            const neighbors = [];

            // Verificar vizinhos (apenas ortogonais)
            if (row > 2 && maze[row - 2][col] === 1) neighbors.push([row - 2, col]);
            if (row < rows - 3 && maze[row + 2][col] === 1) neighbors.push([row + 2, col]);
            if (col > 2 && maze[row][col - 2] === 1) neighbors.push([row, col - 2]);
            if (col < cols - 3 && maze[row][col + 2] === 1) neighbors.push([row, col + 2]);

            if (neighbors.length === 0) {
                stack.pop();
                continue;
            }

            const [nextRow, nextCol] = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[nextRow][nextCol] = 0;
            maze[(row + nextRow) / 2][(col + nextCol) / 2] = 0;
            stack.push([nextRow, nextCol]);
        }

        // Definir entrada e saída em lados opostos
        const sides = [
            { side: 'top', row: 0, col: 1 + Math.floor(Math.random() * (cols - 2)) },
            { side: 'right', row: 1 + Math.floor(Math.random() * (rows - 2)), col: cols - 1 },
            { side: 'bottom', row: rows - 1, col: 1 + Math.floor(Math.random() * (cols - 2)) },
            { side: 'left', row: 1 + Math.floor(Math.random() * (rows - 2)), col: 0 }
        ];

        // Embaralhar os lados
        for (let i = sides.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sides[i], sides[j]] = [sides[j], sides[i]];
        }

        gameState.start = { x: sides[0].col, y: sides[0].row };
        gameState.end = { x: sides[2].col, y: sides[2].row };

        // Abrir caminho para entrada e saída
        maze[gameState.start.y][gameState.start.x] = 0;
        maze[gameState.end.y][gameState.end.x] = 0;

        // Conectar entrada/saída ao labirinto
        if (sides[0].side === 'top') {
            maze[1][gameState.start.x] = 0;
        } else if (sides[0].side === 'right') {
            maze[gameState.start.y][cols - 2] = 0;
        } else if (sides[0].side === 'bottom') {
            maze[rows - 2][gameState.start.x] = 0;
        } else if (sides[0].side === 'left') {
            maze[gameState.start.y][1] = 0;
        }

        if (sides[2].side === 'top') {
            maze[1][gameState.end.x] = 0;
        } else if (sides[2].side === 'right') {
            maze[gameState.end.y][cols - 2] = 0;
        } else if (sides[2].side === 'bottom') {
            maze[rows - 2][gameState.end.x] = 0;
        } else if (sides[2].side === 'left') {
            maze[gameState.end.y][1] = 0;
        }

        // Verificação específica para paredes duas casas após início/fim
        const checkWallTwoCellsAway = (x, y) => {
            const directions = [
                { dx: 0, dy: -2 }, // acima
                { dx: 0, dy: 2 },  // abaixo
                { dx: -2, dy: 0 }, // esquerda
                { dx: 2, dy: 0 }    // direita
            ];

            for (const dir of directions) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;
                if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
                    if (maze[ny][nx] === 1) { // Parede interna
                        // Verifica se não é uma parede externa
                        if (!(nx === 0 || ny === 0 || nx === cols - 1 || ny === rows - 1)) {
                            return false;
                        }
                    }
                }
            }
            return true;
        };

        if (!checkWallTwoCellsAway(gameState.start.x, gameState.start.y) ||
            !checkWallTwoCellsAway(gameState.end.x, gameState.end.y)) {
            isValid = false;
        }

        if (attempts >= maxAttempts) {
            console.warn("Não foi possível gerar um labirinto perfeito após várias tentativas");
            isValid = true; // Aceita o labirinto mesmo com pequenos defeitos
        }
    } while (!isValid);

    gameState.maze = maze;
    gameState.playerPos = { ...gameState.start };
    gameState.reachedEnd = false;
    gameState.path = [];

    drawMaze();
}


// Desenhar labirinto

function drawMaze() {
    const cellSize = Math.min(
        canvas.width / gameState.maze[0].length,
        canvas.height / gameState.maze.length,
        config.cellSize
    );

    const offsetX = (canvas.width - gameState.maze[0].length * cellSize) / 2;
    const offsetY = (canvas.height - gameState.maze.length * cellSize) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar paredes
    ctx.fillStyle = '#8B4513'; // Marrom para paredes externas
    for (let row = 0; row < gameState.maze.length; row++) {
        for (let col = 0; col < gameState.maze[row].length; col++) {
            if (gameState.maze[row][col] === 2) {
                ctx.fillRect(offsetX + col * cellSize, offsetY + row * cellSize, cellSize, cellSize);
            }
        }
    }

    ctx.fillStyle = 'black'; // Preto para paredes internas
    for (let row = 1; row < gameState.maze.length - 1; row++) {
        for (let col = 1; col < gameState.maze[row].length - 1; col++) {
            if (gameState.maze[row][col] === 1) {
                ctx.fillRect(offsetX + col * cellSize, offsetY + row * cellSize, cellSize, cellSize);
            }
        }
    }

    // Desenhar entrada e saída
    ctx.fillStyle = 'green';
    ctx.fillRect(offsetX + gameState.start.x * cellSize, offsetY + gameState.start.y * cellSize, cellSize, cellSize);

    ctx.fillStyle = '#4682B4';
    ctx.fillRect(offsetX + gameState.end.x * cellSize, offsetY + gameState.end.y * cellSize, cellSize, cellSize);

    // Desenhar caminho
    if (gameState.path.length > 1) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = cellSize / 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(
            offsetX + (gameState.path[0].x + 0.5) * cellSize,
            offsetY + (gameState.path[0].y + 0.5) * cellSize
        );
        for (let i = 1; i < gameState.path.length; i++) {
            ctx.lineTo(
                offsetX + (gameState.path[i].x + 0.5) * cellSize,
                offsetY + (gameState.path[i].y + 0.5) * cellSize
            );
        }
        ctx.stroke();
    }

    // Desenhar jogador
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(
        offsetX + (gameState.playerPos.x + 0.5) * cellSize,
        offsetY + (gameState.playerPos.y + 0.5) * cellSize,
        cellSize / 4,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// Iniciar desenho
function startDrawing(e) {
    const pos = getCanvasPosition(e);

    if (isValidPosition(pos)) {
        // Cancela qualquer contagem de inatividade
        resetInactivityTimer();

        // Se for o primeiro movimento, inicia o timer do jogo
        if (gameState.path.length === 0) {
            gameState.path = [gameState.start];
            gameState.playerPos = { ...gameState.start };
            startTimer();
        }

        gameState.isDrawing = true;

        const lastPos = gameState.path[gameState.path.length - 1];
        if (pos.x !== lastPos.x || pos.y !== lastPos.y) {
            gameState.path.push(pos);
            gameState.playerPos = { ...pos };
            checkEndReached();
        }
    }
}
// Continuar desenho 
function draw(e) {
    if (!gameState.isDrawing || gameState.reachedEnd || gameState.isPaused) return;

    // Cancela qualquer contagem de inatividade
    resetInactivityTimer();

    const pos = getCanvasPosition(e);
    const lastPos = gameState.path[gameState.path.length - 1];

    if (isValidPosition(pos) &&
        Math.abs(pos.x - lastPos.x) <= 1 &&
        Math.abs(pos.y - lastPos.y) <= 1) {
        gameState.path.push(pos);
        gameState.playerPos = { ...pos };
        checkEndReached();
        drawMaze();
    }
}

// Adicione esta nova função para gerenciar o timer de inatividade
function resetInactivityTimer() {
    // Limpa o timer existente
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }

    // Cancela a contagem regressiva se estiver ativa
    if (countdownActive) {
        countdownActive = false;
        startBarContainer.style.display = 'none';
    }

    // Armazena o momento do último movimento
    lastMoveTime = Date.now();

    // Configura um novo timer apenas se o jogo não estiver pausado e houver um caminho iniciado
    if (!gameState.isPaused && gameState.path.length > 0) {
        inactivityTimer = setTimeout(() => {
            // Se chegou aqui, o jogador ficou inativo por 5 segundos
            startVisualCountdown();
        }, INACTIVITY_TIMEOUT);
    }
}

// Parar desenho
function stopDrawing() {
    gameState.isDrawing = false;
}

// Manipuladores de toque
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup');
    canvas.dispatchEvent(mouseEvent);
}

// Obter posição no canvas
function getCanvasPosition(e) {
    const cellSize = Math.min(
        canvas.width / gameState.maze[0].length,
        canvas.height / gameState.maze.length,
        config.cellSize
    );

    const offsetX = (canvas.width - gameState.maze[0].length * cellSize) / 2;
    const offsetY = (canvas.height - gameState.maze.length * cellSize) / 2;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x - offsetX) / cellSize);
    const row = Math.floor((y - offsetY) / cellSize);

    return { x: col, y: row };
}

// Verificar posição válida
function isValidPosition(pos) {
    if (pos.x < 0 || pos.y < 0 ||
        pos.x >= gameState.maze[0].length || pos.y >= gameState.maze.length) {
        return false;
    }

    if (pos.x === gameState.start.x && pos.y === gameState.start.y) return true;
    if (pos.x === gameState.end.x && pos.y === gameState.end.y) return true;

    return gameState.maze[pos.y][pos.x] === 0;
}

// Verificar se chegou ao final
function checkEndReached() {
    if (gameState.isPaused) return;
    const lastPoint = gameState.path[gameState.path.length - 1];
    if (lastPoint && lastPoint.x === gameState.end.x && lastPoint.y === gameState.end.y) {
        if (isPathValid()) {
            gameState.reachedEnd = true;
            nextLevel();
        }
    }
}

// Verificar se o caminho é válido
function isPathValid() {
    if (gameState.path.length < 2) return false;

    const first = gameState.path[0];
    const last = gameState.path[gameState.path.length - 1];

    if (first.x !== gameState.start.x || first.y !== gameState.start.y) return false;
    if (last.x !== gameState.end.x || last.y !== gameState.end.y) return false;

    const cleanPath = gameState.path.filter((point, index) => {
        if (index === 0) return true;
        const prev = gameState.path[index - 1];
        return point.x !== prev.x || point.y !== prev.y;
    });

    for (let i = 1; i < cleanPath.length; i++) {
        const prev = cleanPath[i - 1];
        const curr = cleanPath[i];

        const dx = Math.abs(curr.x - prev.x);
        const dy = Math.abs(curr.y - prev.y);

        if (dx > 1 || dy > 1) return false;
        if (i < cleanPath.length - 1 && gameState.maze[curr.y][curr.x] === 1) return false;
    }

    return true;
}

// Próximo nível
function nextLevel() {
    // Calcula pontuação
    gameState.score += config.scorePerLevel * gameState.level;

    // Aumenta o nível
    gameState.level++;

    // Define o tempo para 30s + (15s por nível adicional)
    gameState.timeLeft = config.timePerLevel + ((gameState.level - 1) * 15);

    // Atualiza a interface e gera novo labirinto
    updateUI();
    generateMaze();

    // Inicia a contagem regressiva visual para o novo nível
    startVisualCountdown();
}

// Reiniciar caminho
function resetPath() {
    // Limpa o timer de desenho se existir
    if (gameState.isDrawing) {
        gameState.isDrawing = false;
    }

    // Reseta apenas o caminho
    gameState.path = [];
    gameState.playerPos = { ...gameState.start };
    gameState.reachedEnd = false;

    // Não mexe no timer!
    drawMaze();

    console.log(`Trilha reiniciada no nível ${gameState.level} (Tempo atual: ${gameState.timeLeft}s)`);
}

// Iniciar temporizador
function startTimer() {
    if (gameState.timer || gameState.isPaused) return;

    gameState.timer = setInterval(() => {
        if (!gameState.isPaused) {
            gameState.timeLeft--;
            updateUI();

            if (gameState.timeLeft <= 0) {
                clearInterval(gameState.timer);
                showEndScreen(false);
            }
        }
    }, 1000);
}

// Reiniciar jogo
function resetGame() {
    endScreen.style.display = 'none';

    gameState.score = 0;
    gameState.level = 1;
    gameState.timeLeft = config.timePerLevel;
    gameState.path = [];
    gameState.gameStarted = false;

    startScreen.style.display = 'flex';
    restartButton.style.display = 'none';

    updateUI();
}

// Atualizar UI
function updateUI() {
    scoreElement.textContent = `Pontuação: ${gameState.score}`;
    levelElement.textContent = `Nível: ${gameState.level}`;
    timerElement.textContent = `Tempo: ${gameState.timeLeft}s`;

    // Atualiza o display do recorde
    loadHighScore().then(highScore => {
        const highScoreDisplay = document.getElementById('high-score-display');
        highScoreDisplay.innerHTML = `
                          <div>Recorde: ${highScore.score} pontos / Nível: ${highScore.level}</div>
                          <div>Jogador: ${highScore.name}</div>
                        `;
        highScoreDisplay.style.display = 'block';
    });
}


let fullscreenRequested = false;

function toggleFullscreen() {
    if (fullscreenRequested) return;

    if (!document.fullscreenElement) {
        fullscreenRequested = true;

        // Cria um botão invisível temporário
        const tempButton = document.createElement('button');
        tempButton.style.position = 'fixed';
        tempButton.style.opacity = '0';
        tempButton.style.pointerEvents = 'none';
        tempButton.style.zIndex = '-1000';
        document.body.appendChild(tempButton);

        // Adiciona o evento de clique
        tempButton.addEventListener('click', () => {
            document.documentElement.requestFullscreen()
                .catch(err => {
                    console.error('Erro ao entrar em tela cheia:', err);
                })
                .finally(() => {
                    document.body.removeChild(tempButton);
                    fullscreenRequested = false;
                });
        });

        // Dispara o clique
        tempButton.click();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Recorde inicial padrão (vazio)
const DEFAULT_HIGH_SCORE = {
    name: 'Anônimo',
    score: 0,
    level: 1
};

// Função para carregar o recorde
async function loadHighScore() {
    try {
        const response = await fetch('highscore.php');
        if (!response.ok) throw new Error("HTTP error");
        const data = await response.json();

        // Verifica se tem todos os campos necessários
        if (data && typeof data.score !== 'undefined' && typeof data.level !== 'undefined') {
            return data;
        }
        throw new Error("Dados inválidos");
    } catch (error) {
        console.warn("Falha ao carregar do servidor, usando fallback:", error);
        const localScore = localStorage.getItem('mazeHighScore');
        return localScore ? JSON.parse(localScore) : DEFAULT_HIGH_SCORE;
    }
}

// Função para salvar o recorde
async function saveHighScore(name, score, level) {
    const highScore = { name, score, level };

    try {
        // Tenta salvar no servidor
        const response = await fetch('highscore.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(highScore)
        });

        if (!response.ok) throw new Error('Falha no servidor');

        // Se sucesso no servidor, salva localmente também
        localStorage.setItem('mazeHighScore', JSON.stringify(highScore));
    } catch (error) {
        console.log('Salvando apenas localmente:', error);
        localStorage.setItem('mazeHighScore', JSON.stringify(highScore));
    }
}

// Função para atualizar a exibição
function updateHighScoreDisplay() {
    loadHighScore().then(highScore => {
        const display = document.getElementById('high-score-display');
        display.textContent = `${highScore.name} - Nível ${highScore.level} - ${highScore.score} pontos`;
        display.style.display = 'block';
    });
}



// Mostrar tela final
async function showEndScreen(win) {
    const currentScore = gameState.score;
    const currentLevel = gameState.level;
    const highScore = await loadHighScore();

    let message = win ? "Você Venceu!" : "Tempo Esgotado!";
    message += `<br>🏆 Seu Progresso: Nível ${currentLevel - 1} - ${currentScore} pontos`;

    // Verifica se bateu o recorde
    if (currentScore > highScore.score ||
        (currentScore === highScore.score && currentLevel > highScore.level)) {
        const playerName = prompt("🏆 Novo recorde! Digite seu nome:", highScore.name);
        if (playerName !== null && playerName.trim() !== '') {
            await saveHighScore(playerName.trim(), currentScore, currentLevel - 1);
            updateHighScoreDisplay();
            message += `<br>🏆 Novo recorde estabelecido!`;
        }
    } else {
        message += `<br>🏆 Recorde atual: ${highScore.name} - Nível ${highScore.level - 1} - ${highScore.score} pontos`;
    }

    endMessage.innerHTML = message;
    endScore.textContent = `Nível ${currentLevel - 1} - ${currentScore} pontos`;
    endScreen.style.display = 'flex';
}

// Inicializar
window.addEventListener('load', init);