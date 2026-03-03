import { state } from './state.js';
import { saveToLocal } from './storage.js';
import { calculateReadingTime, updateGlobalStats } from './ui-renderer.js';

const setupView = document.getElementById('setup-view');
const prompterView = document.getElementById('prompter-view');
const prompterText = document.getElementById('prompter-text');
const progressIndicator = document.getElementById('progress-indicator');
const fontSliderPanel = document.getElementById('font-slider-panel');
const jumpMenuOverlay = document.getElementById('jump-menu-overlay');
const jumpListContent = document.getElementById('jump-list-content');
const fontSizeSlider = document.getElementById('font-size-slider');

function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(() => { }); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
    else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
}

function exitFullscreenMode() {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) { document.exitFullscreen(); }
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
        else if (document.msExitFullscreen) { document.msExitFullscreen(); }
    }
}

export function startPrompter() {
    if (state.cardsData.length === 0) return;
    enterFullscreen();
    setupView.style.display = 'none'; prompterView.style.display = 'block';
    prompterText.style.fontSize = state.fontSize + 'vh';
    fontSizeSlider.value = state.fontSize;
    state.currentCardIndex = 0; renderPrompterCard();
}

export function exitPrompter() {
    exitFullscreenMode();
    prompterView.style.display = 'none'; setupView.style.display = 'flex'; fontSliderPanel.style.display = 'none';
}

function renderPrompterCard() {
    if (state.cardsData.length === 0) return;
    prompterText.innerText = state.cardsData[state.currentCardIndex].text;
    progressIndicator.textContent = `${state.currentCardIndex + 1} / ${state.cardsData.length}`;
}

export function nextCard() { if (state.currentCardIndex < state.cardsData.length - 1) { state.currentCardIndex++; renderPrompterCard(); } }
export function prevCard() { if (state.currentCardIndex > 0) { state.currentCardIndex--; renderPrompterCard(); } }

export function handlePrompterInput(e) {
    if (state.cardsData.length === 0) return;
    const newText = e.target.innerText;
    const currentCard = state.cardsData[state.currentCardIndex];
    currentCard.text = newText;
    const textarea = document.querySelector(`textarea[data-id="${currentCard.id}"]`);
    if (textarea) {
        textarea.value = newText;
        textarea.nextElementSibling.querySelector('span').textContent = `${newText.length} car. | ~${calculateReadingTime(newText)}s`;
    }
    const markNode = document.getElementById(`mark-${currentCard.id}`);
    if (markNode) markNode.innerText = newText;
    updateGlobalStats(); saveToLocal();
}

export function toggleFontSlider(e) {
    e.stopPropagation();
    fontSliderPanel.style.display = fontSliderPanel.style.display === 'flex' ? 'none' : 'flex';
}

export function openJumpMenu() {
    jumpListContent.innerHTML = '';
    state.cardsData.forEach((card, index) => {
        const item = document.createElement('div'); item.className = 'jump-item';
        const previewText = card.text.length > 60 ? card.text.substring(0, 60) + '...' : card.text;
        item.innerHTML = `<div class="jump-num">${index + 1}.</div><div class="jump-text">${previewText}</div>`;
        item.addEventListener('click', () => { state.currentCardIndex = index; renderPrompterCard(); closeJumpMenu(); });
        jumpListContent.appendChild(item);
    });
    jumpMenuOverlay.style.display = 'flex'; fontSliderPanel.style.display = 'none';
}

export function closeJumpMenu() { jumpMenuOverlay.style.display = 'none'; }

export function handleKeydown(e) {
    if (jumpMenuOverlay.style.display === 'flex') { if (e.key === 'Escape') closeJumpMenu(); return; }
    if (prompterView.style.display !== 'block') return;
    if (document.activeElement === prompterText) { if (e.key === 'Escape') { prompterText.blur(); } return; }

    const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown'];
    const prevKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

    if (nextKeys.includes(e.key)) { e.preventDefault(); nextCard(); }
    else if (prevKeys.includes(e.key)) { e.preventDefault(); prevCard(); }
    else if (e.key === 'Escape') { exitPrompter(); }
}

export function updateFontSize(e) {
    state.fontSize = Number(e.target.value);
    prompterText.style.fontSize = state.fontSize + 'vh';
    saveToLocal();
}
