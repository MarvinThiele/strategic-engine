import './styles/globals.css';
import { PixiGame } from './pixi/PixiGame';

// Initialize the Pixi game
const game = new PixiGame();

game.init().then((canvas) => {
  // Prevent right-click context menu
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Mount to DOM
  document.getElementById('root')!.appendChild(canvas);

  console.log('[Main] Pixi game mounted');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  game.destroy();
});
