// Główny moduł gry
const MiniDoom = (function() {
  // Elementy canvas i kontekst
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  
  // Elementy UI
  const statusElement = document.getElementById('status');
  const healthBar = document.getElementById('health-fill');
  const coinText = document.getElementById('coin-text');
  const nextWaveBtn = document.getElementById('next-wave');
  const upgradeContainer = document.getElementById('upgrade-container');
  const waveDisplay = document.getElementById('wave-display');
  const scoreDisplay = document.getElementById('score-display');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScore = document.getElementById('final-score');
  const restartButton = document.getElementById('restart-button');
  
  // Gracz
  const player = {
    x: canvas.width/2,
    y: canvas.height/2,
    radius: 18,
    speed: 3.5,
    maxHealth: 100,
    health: 100,
    bullets: [],
    score: 0,
    bulletSpeed: 8,
    bulletDamage: 10,
    bulletSize: 5,
    bulletCount: 1,
    fireRate: 100,
    lastShot: 0,
    coins: 0,
    upgradeLevels: {
      size: 0,
      multishot: 0,
      damage: 0
    }
  };
  
  // Przeciwnicy i fale
  const enemies = [];
  let currentWave = 1;
  let upgradePhase = false;
  let gameActive = true;
  
  // Efekty
  const particles = [];
  const effects = [];
  
  // Sterowanie
  const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
  
  // Celownik
  let mouse = { x: player.x, y: player.y };
  
  // Ostatnia klatka animacji
  let lastFrameTime = 0;
  
  // Inicjalizacja gry
  function init() {
    resizeCanvas();
    bindEvents();
    showStatus('Gra załadowana! Przygotuj się na nadchodzące fale przeciwników...');
    updateScoreDisplay();
    updateHealthBar();
    updateCoinText();
    updateUpgradePrices();
    spawnEnemies(5);
    
    // Uruchomienie pętli gry
    requestAnimationFrame(gameLoop);
  }
  
  // Dostosowanie rozmiaru canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
  }
  
  // Powiązanie zdarzeń
  function bindEvents() {
    // Obsługa przycisków
    document.addEventListener('keydown', e => {
      if (e.code in keys) keys[e.code] = true;
    });
    
    document.addEventListener('keyup', e => {
      if (e.code in keys) keys[e.code] = false;
    });
    
    // Obsługa myszy
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    
    // Obsługa ulepszeń
    document.getElementById('upgrade1').addEventListener('click', () => applyUpgrade('size'));
    document.getElementById('upgrade2').addEventListener('click', () => applyUpgrade('multishot'));
    document.getElementById('upgrade3').addEventListener('click', () => applyUpgrade('damage'));
    
    // Obsługa przycisku następnej fali
    nextWaveBtn.addEventListener('click', startNextWave);
    
    // Obsługa przycisku ponownej gry
    restartButton.addEventListener('click', restartGame);
    
    // Obsługa zmiany rozmiaru okna
    window.addEventListener('resize', resizeCanvas);
  }
  
  // Obsługa ruchu myszy
  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  
  // Obsługa kliknięcia
  function handleClick() {
    if (!gameActive || upgradePhase) return;
    
    const now = Date.now();
    if (now - player.lastShot > player.fireRate) {
      shootBullets();
      player.lastShot = now;
    }
  }
  
  // Strzelanie
  function shootBullets() {
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    
    // Strzelanie wielokrotnym strzałem
    const spread = 0.4; 
    const bulletsToFire = player.bulletCount;
    
    for (let i = 0; i < bulletsToFire; i++) {
      const offset = (i / (bulletsToFire - 1 || 1) - 0.5) * spread;
      const bulletAngle = angle + offset;
      
      // Calculate bullet starting position slightly away from player center
      const startX = player.x + Math.cos(bulletAngle) * player.radius;
      const startY = player.y + Math.sin(bulletAngle) * player.radius;
      
      player.bullets.push({
        x: startX,
        y: startY,
        dx: Math.cos(bulletAngle) * player.bulletSpeed,
        dy: Math.sin(bulletAngle) * player.bulletSpeed,
        radius: player.bulletSize,
        color: '#00fff7'
      });
      
      // Remove this line to eliminate the white flash effect
      // createFlashEffect(startX, startY);
    }
    
    // Dodaj efekt odrzutu
    player.x -= Math.cos(angle) * 1.5;
    player.y -= Math.sin(angle) * 1.5;
  }
  
  // Tworzenie efektu błysku
  function createFlashEffect(x, y) {
    effects.push({
      x: x,
      y: y,
      radius: player.bulletSize * 2,
      maxRadius: player.bulletSize * 3,
      alpha: 1,
      type: 'flash'
    });
  }
  
  // Tworzenie cząsteczek po zniszczeniu przeciwnika
  function createExplosion(x, y, color) {
    const particleCount = 15;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      
      particles.push({
        x: x,
        y: y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * 3,
        color: color,
        alpha: 1,
        life: 30 + Math.random() * 20
      });
    }
  }
  
  // Tworzenie przeciwników - zmieniona logika spawnu
  function spawnEnemies(count) {
    enemies.length = 0;
    const enemyBaseHealth = 20 + (currentWave-1)*5;
    const enemyBaseSpeed = 1.5; // Stała prędkość, nie zwiększa się z falami
    const enemyBaseCoins = 5 + Math.floor(currentWave**1.5);
    
    const minimumDistanceFromPlayer = 150; // Minimalna odległość od gracza
    
    for (let i = 0; i < count; i++) {
      let x, y;
      let tooClose;
      
      // Próbuj znaleźć pozycję nie za blisko gracza
      do {
        // Losowa pozycja na mapie
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
        
        // Sprawdź czy nie za blisko gracza
        tooClose = Math.hypot(x - player.x, y - player.y) < minimumDistanceFromPlayer;
      } while (tooClose);
      
      enemies.push({
        x: x,
        y: y,
        radius: 22,
        speed: enemyBaseSpeed,
        health: enemyBaseHealth,
        maxHealth: enemyBaseHealth,
        coins: enemyBaseCoins,
        alive: true,
        color: 'red'
      });
    }
    
    // Regeneracja życia na początek fali
    player.health = player.maxHealth;
    updateHealthBar();
  }
  
  // Wyświetlanie ulepszeń
  function showUpgrades() {
    upgradePhase = true;
    upgradeContainer.style.display = 'flex';
    nextWaveBtn.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    
    // Aktualizacja cen przy każdym pokazaniu menu ulepszeń
    updateUpgradePrices();
  }
  
  // Ukrywanie ulepszeń
  function hideUpgrades() {
    upgradePhase = false;
    upgradeContainer.style.display = 'none';
    nextWaveBtn.style.display = 'none';
    canvas.style.pointerEvents = 'auto';
  }
  
  // Aplikowanie ulepszeń
  function applyUpgrade(type) {
    const cost = getUpgradePrice(type);
    
    if (player.coins >= cost) {
      player.coins -= cost;
      player.upgradeLevels[type]++;
      updateCoinText();
      updateUpgradePrices();
      
      switch(type) {
        case 'size':
          player.bulletSize += 2;
          showStatus(`Ulepszenie: Większy rozmiar pocisków (${player.bulletSize})`);
          break;
        case 'multishot':
          player.bulletCount += 1;
          showStatus(`Ulepszenie: Więcej pocisków (${player.bulletCount})`);
          break;
        case 'damage':
          player.bulletDamage += 5;
          showStatus(`Ulepszenie: Zwiększone obrażenia (${player.bulletDamage})`);
          break;
      }
    } else {
      showStatus('Nie masz wystarczającej liczby monet!');
    }
  }
  
  // Rozpoczęcie następnej fali - więcej przeciwników
  function startNextWave() {
    hideUpgrades();
    currentWave++;
    waveDisplay.textContent = `Fala: ${currentWave}`;
    // Zwiększ liczbę przeciwników bardziej agresywnie
    spawnEnemies(5 + currentWave*3); // Zmienione z *2 na *3 dla większego przyrostu
    showStatus(`Fala ${currentWave} rozpoczęta! Liczba przeciwników: ${enemies.length}`);
  }
  
  // Aktualizacja paska zdrowia
  function updateHealthBar() {
    healthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
  }
  
  // Aktualizacja liczby monet
  function updateCoinText() {
    coinText.innerHTML = `
      <svg class="w-6 h-6 mr-2 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"></path>
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"></path>
      </svg>
      Monety: ${player.coins}
    `;
  }
  
  // Aktualizacja wyświetlacza wyniku
  function updateScoreDisplay() {
    scoreDisplay.textContent = `Wynik: ${player.score}`;
  }
  
  // Wyświetlanie komunikatu statusu
  function showStatus(message) {
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    statusElement.classList.add('visible');
    
    // Ukrywaj po 3 sekundach
    setTimeout(() => {
      statusElement.classList.remove('visible');
      // Hide after animation completes
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 300);
    }, 2700);
  }
  
  // Koniec gry
  function gameOver() {
    gameActive = false;
    finalScore.textContent = `Wynik: ${player.score}`;
    gameOverScreen.style.display = 'flex';
  }
  
  // Restart gry
  function restartGame() {
    player.health = player.maxHealth;
    player.score = 0;
    player.coins = 0;
    player.bulletSize = 5;
    player.bulletCount = 1;
    player.bulletDamage = 10;
    currentWave = 1;
    
    player.upgradeLevels = {
      size: 0,
      multishot: 0,
      damage: 0
    };
    
    enemies.length = 0;
    player.bullets.length = 0;
    particles.length = 0;
    effects.length = 0;
    
    updateHealthBar();
    updateCoinText();
    updateScoreDisplay();
    waveDisplay.textContent = `Fala: ${currentWave}`;
    
    gameOverScreen.style.display = 'none';
    gameActive = true;
    
    spawnEnemies(5);
    showStatus('Nowa gra rozpoczęta!');
  }
  
  // Aktualizacja logiki gry
  function update(deltaTime) {
    if (!gameActive || upgradePhase) return;
    
    // Ruch gracza
    updatePlayerMovement();
    
    // Ruch pocisków
    updateBullets();
    
    // Ruch przeciwników
    updateEnemies();
    
    // Kolizje
    checkCollisions();
    
    // Aktualizacja cząsteczek
    updateParticles();
    
    // Aktualizacja efektów
    updateEffects();
  }
  
  // Aktualizacja ruchu gracza
  function updatePlayerMovement() {
    // Obliczanie wektora ruchu
    let dx = 0;
    let dy = 0;
    
    if (keys.KeyW) dy -= 1;
    if (keys.KeyS) dy += 1;
    if (keys.KeyA) dx -= 1;
    if (keys.KeyD) dx += 1;
    
    // Normalizacja wektora dla diagonalnego ruchu
    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }
    
    // Aktualizacja pozycji gracza
    player.x += dx * player.speed;
    player.y += dy * player.speed;
    
    // Ograniczenie do granic ekranu
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
  }
  
  // Aktualizacja pocisków
  function updateBullets() {
    for (let i = player.bullets.length - 1; i >= 0; i--) {
      const bullet = player.bullets[i];
      bullet.x += bullet.dx;
      bullet.y += bullet.dy;
      
      // Usunięcie pocisków poza ekranem
      if (bullet.x < 0 || bullet.x > canvas.width || 
          bullet.y < 0 || bullet.y > canvas.height) {
        player.bullets.splice(i, 1);
      }
    }
  }
  
  // Aktualizacja przeciwników
  function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (!enemy.alive) continue;
      
      // Ruch w kierunku gracza
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed;
      enemy.y += Math.sin(angle) * enemy.speed;
    }
    
    // Sprawdzenie czy wszyscy przeciwnicy zostali pokonani
    if (enemies.every(enemy => !enemy.alive) && gameActive) {
      showStatus(`Fala ${currentWave} ukończona!`);
      showUpgrades();
    }
  }
  
  // Sprawdzanie kolizji
  function checkCollisions() {
    // Kolizje pocisków z przeciwnikami
    for (let i = player.bullets.length - 1; i >= 0; i--) {
      const bullet = player.bullets[i];
      
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (!enemy.alive) continue;
        
        const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
        
        if (distance < bullet.radius + enemy.radius) {
          // Zadawanie obrażeń
          enemy.health -= player.bulletDamage;
          
          // Usunięcie pocisku
          player.bullets.splice(i, 1);
          
          // Tworzenie efektu eksplozji
          createExplosion(bullet.x, bullet.y, '#ff6600');
          
          // Sprawdzenie czy przeciwnik został zniszczony
          if (enemy.health <= 0) {
            enemy.alive = false;
            player.score += 10 * currentWave;
            player.coins += enemy.coins;
            updateScoreDisplay();
            updateCoinText();
            createExplosion(enemy.x, enemy.y, enemy.color);
          }
          
          break; // Przerwij, bo pocisk już zniknął
        }
      }
    }
    
    // Kolizje gracza z przeciwnikami
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive) continue;
      
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      
      if (distance < player.radius + enemy.radius) {
        // Gracz otrzymuje obrażzenia
        player.health -= 5;
        updateHealthBar();
        
        // Odrzut gracza
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        player.x += Math.cos(angle) * 20;
        player.y += Math.sin(angle) * 20;
        
        // Ograniczenie do granic ekranu
        player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
        
        // Sprawdzenie końca gry
        if (player.health <= 0) {
          gameOver();
          return;
        }
      }
    }
  }
  
  // Aktualizacja cząsteczek
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      
      particle.x += particle.dx;
      particle.y += particle.dy;
      particle.alpha -= 0.02;
      particle.life--;
      
      if (particle.alpha <= 0 || particle.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }
  
  // Aktualizacja efektów
  function updateEffects() {
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      
      if (effect.type === 'flash') {
        effect.radius += 0.5;
        effect.alpha -= 0.1;
        
        if (effect.radius >= effect.maxRadius || effect.alpha <= 0) {
          effects.splice(i, 1);
        }
      }
    }
  }
  
  // Renderowanie gry
  function render() {
    // Wyczyść ekran
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Narysuj siatkę (opcjonalnie)
    drawGrid();
    
    // Narysuj gracza
    drawPlayer();
    
    // Narysuj pociski
    drawBullets();
    
    // Narysuj przeciwników
    drawEnemies();
    
    // Narysuj cząsteczki
    drawParticles();
    
    // Narysuj efekty
    drawEffects();
  }
  
  // Rysowanie siatki
  function drawGrid() {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }
  
  // Rysowanie gracza
  function drawPlayer() {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#00fff7';
    ctx.fill();
    
    // Kierunek gracza
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
      player.x + Math.cos(angle) * player.radius,
      player.y + Math.sin(angle) * player.radius
    );
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  
  // Rysowanie pocisków
  function drawBullets() {
    for (const bullet of player.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fillStyle = bullet.color;
      ctx.fill();
      
      // Efekt blasku
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 247, 0.3)';
      ctx.fill();
    }
  }
  
  // Rysowanie przeciwników
  function drawEnemies() {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      
      // Ciało przeciwnika
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      
      // Pasek zdrowia
      const healthBarWidth = enemy.radius * 2;
      const healthPercent = enemy.health / enemy.maxHealth;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemy.radius - 10, healthBarWidth, 5);
      
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemy.radius - 10, healthBarWidth * healthPercent, 5);
    }
  }
  
  // Rysowanie cząsteczek
  function drawParticles() {
    for (const particle of particles) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRgb(particle.color)}, ${particle.alpha})`;
      ctx.fill();
    }
  }
  
  // Konwersja hex do rgb
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '255, 255, 255';
  }
  
  // Rysowanie efektów
  function drawEffects() {
    for (const effect of effects) {
      if (effect.type === 'flash') {
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${effect.alpha})`;
        ctx.fill();
      }
    }
  }
  
  // Główna pętla gry
  function gameLoop(currentTime) {
    // Obliczenie delta czasu
    const deltaTime = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;
    
    // Aktualizacja i renderowanie
    update(deltaTime);
    render();
    
    // Kontynuacja pętli
    requestAnimationFrame(gameLoop);
  }
  
  // Obliczanie ceny ulepszenia - zwiększone stawki
  function getUpgradePrice(type) {
    const basePrice = {
      size: 10,
      multishot: 15,
      damage: 15
    };
    
    // Nowe wzory cenowe według wymagań
    switch(type) {
      case 'size':
        // Cena x2 za każdy poziom wielkości
        return basePrice[type] * Math.pow(2, player.upgradeLevels[type]);
      case 'multishot':
      case 'damage':
        // +10 za każdy poziom ilości i mocy
        return basePrice[type] + (player.upgradeLevels[type] * 10);
      default:
        return basePrice[type];
    }
  }
  
  // Aktualizacja cen w UI
  function updateUpgradePrices() {
    const upgrade1Price = document.querySelector('#upgrade1 .ml-auto');
    const upgrade2Price = document.querySelector('#upgrade2 .ml-auto');
    const upgrade3Price = document.querySelector('#upgrade3 .ml-auto');
    
    upgrade1Price.textContent = getUpgradePrice('size');
    upgrade2Price.textContent = getUpgradePrice('multishot');
    upgrade3Price.textContent = getUpgradePrice('damage');
  }
  
  // Inicjalizacja i uruchomienie gry
  return {
    init: init
  };
})();

// Uruchomienie gry po załadowaniu strony
window.addEventListener('load', function() {
  MiniDoom.init();
});