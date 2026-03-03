// --- IMPORTANTE: Entorno de Ejecución ---
// Al utilizar <script type="module">, este archivo DEBE abrirse a través de un
// servidor web local (ej. Live Server, python -m http.server) para evitar errores
// de CORS. No funcionará abriendo el HTML haciendo doble clic desde el sistema de archivos (file://).

import { state } from './state.js';
import { loadFromLocal, loadFileContent, saveToLocal } from './storage.js';
import { renderSidebar, deleteCard, updateGlobalStats } from './ui-renderer.js';
import { startPrompter, exitPrompter, openJumpMenu, closeJumpMenu, toggleFontSlider, handlePrompterInput, nextCard, prevCard, handleKeydown, updateFontSize } from './prompter-engine.js';
import { historyManager } from './history-manager.js';

const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name-display');
const textContainer = document.getElementById('text-container');
const cardsList = document.getElementById('cards-list');
const btnStart = document.getElementById('btn-start');
const prompterView = document.getElementById('prompter-view');
const prompterText = document.getElementById('prompter-text');
const fontSliderPanel = document.getElementById('font-slider-panel');
const fontSizeSlider = document.getElementById('font-size-slider');
const jumpMenuOverlay = document.getElementById('jump-menu-overlay');

// --- EVENTOS DEL PANEL PRINCIPAL (SETUP) ---

fileInput.addEventListener('change', (e) => loadFileContent(e.target.files[0]));
textContainer.addEventListener('dragover', (e) => { e.preventDefault(); textContainer.classList.add('dragover'); });
textContainer.addEventListener('dragleave', () => textContainer.classList.remove('dragover'));
textContainer.addEventListener('drop', (e) => {
    e.preventDefault(); textContainer.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) loadFileContent(e.dataTransfer.files[0]);
});

document.getElementById('btn-save').addEventListener('click', async () => {
    if (!textContainer.innerText.trim() && state.cardsData.length === 0) return;
    const projectData = { originalText: state.originalTextContent, currentHtml: textContainer.innerHTML, cards: state.cardsData, colorIndex: state.colorIndex };
    const jsonStr = JSON.stringify(projectData, null, 2);
    let exportName = fileNameDisplay.textContent.replace('.txt', '').replace('.json', '');
    if (exportName === "Ningún archivo cargado" || exportName === "Proyecto Recuperado") exportName = "proyecto_prompter";

    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({ suggestedName: exportName + '.json', types: [{ description: 'Proyecto JSON', accept: { 'application/json': ['.json'] } }] });
            const writable = await handle.createWritable(); await writable.write(jsonStr); await writable.close();
        } else {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
            const a = document.createElement('a'); a.href = dataStr; a.download = exportName + ".json";
            document.body.appendChild(a); a.click(); a.remove();
        }
    } catch (error) { }
});

document.getElementById('btn-undo').addEventListener('click', () => { historyManager.undoHistory(); });
document.getElementById('btn-refresh').addEventListener('click', () => { if (state.originalTextContent) { textContainer.textContent = state.originalTextContent; state.cardsData = []; cardsList.innerHTML = ''; state.colorIndex = 0; updateGlobalStats(); saveToLocal(); historyManager.pushHistory(); } });
document.getElementById('btn-clear').addEventListener('click', () => { state.originalTextContent = ""; fileInput.value = ""; fileNameDisplay.textContent = "Ningún archivo cargado"; textContainer.textContent = "Arrastra aquí tu archivo .txt o tu proyecto .json para empezar..."; state.cardsData = []; cardsList.innerHTML = ''; state.colorIndex = 0; updateGlobalStats(); localStorage.removeItem('prompterAutosave'); historyManager.pushHistory(); });

let debounceTimer;
textContainer.addEventListener('input', () => {
    updateGlobalStats();
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        let node = selection.anchorNode;
        while (node && node !== textContainer) {
            if (node.nodeName === 'MARK' && node.id.startsWith('mark-')) {
                const cardId = parseInt(node.id.replace('mark-', ''));
                const newText = node.innerText;
                const cardIndex = state.cardsData.findIndex(c => c.id === cardId);
                if (cardIndex > -1) {
                    state.cardsData[cardIndex].text = newText;
                    const textarea = document.querySelector(`textarea[data-id="${cardId}"]`);
                    if (textarea) {
                        textarea.value = newText;
                        const timeStr = Math.ceil((newText.trim().split(/\s+/).length / 130) * 60) + "s"; // 130 WPM temporal
                        textarea.nextElementSibling.querySelector('span').textContent = `${newText.length} car. | ~${timeStr}`;
                    }
                }
                break;
            }
            node = node.parentNode;
        }
    }
    saveToLocal();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { historyManager.pushHistory(); }, 500);
});

textContainer.addEventListener('mouseup', function () {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const cardId = Date.now();
    const range = selection.getRangeAt(0);
    const markNode = document.createElement('mark');
    markNode.className = `highlight c${state.colorIndex % 4}`; markNode.id = `mark-${cardId}`;
    try { markNode.appendChild(range.extractContents()); range.insertNode(markNode); } catch (e) { console.warn("Selección cruzada"); }

    state.cardsData.push({ id: cardId, text: selectedText });
    state.colorIndex++; selection.removeAllRanges();

    const markElements = Array.from(textContainer.querySelectorAll('mark.highlight'));
    const sortedCards = [];
    markElements.forEach(mark => {
        const id = parseInt(mark.id.replace('mark-', ''));
        const card = state.cardsData.find(c => c.id === id);
        if (card) sortedCards.push(card);
    });
    state.cardsData = sortedCards;

    renderSidebar(); saveToLocal();
    historyManager.pushHistory();
});

// Delegación de eventos para la lista de tarjetas
cardsList.addEventListener('click', (e) => {
    const btnDelete = e.target.closest('.btn-delete');
    if (btnDelete) {
        const cardItem = btnDelete.closest('.card-item');
        if (cardItem) {
            const id = parseInt(cardItem.dataset.id);
            deleteCard(id);
        }
    }
});


// --- EVENTOS DEL PROMPTER ---

btnStart.addEventListener('click', startPrompter);
document.getElementById('btn-exit-prompter').addEventListener('click', (e) => { e.stopPropagation(); exitPrompter(); });
document.getElementById('btn-menu-prompter').addEventListener('click', (e) => { e.stopPropagation(); openJumpMenu(); });
document.getElementById('btn-font-prompter').addEventListener('click', toggleFontSlider);
prompterView.addEventListener('click', () => { fontSliderPanel.style.display = 'none'; });
fontSliderPanel.addEventListener('click', (e) => e.stopPropagation());
prompterText.addEventListener('input', handlePrompterInput);
document.getElementById('zone-right').addEventListener('click', nextCard);
document.getElementById('zone-left').addEventListener('click', prevCard);
fontSizeSlider.addEventListener('input', updateFontSize);
document.getElementById('btn-close-jump').addEventListener('click', closeJumpMenu);
jumpMenuOverlay.addEventListener('click', (e) => { if (e.target === jumpMenuOverlay) closeJumpMenu(); });
document.addEventListener('keydown', handleKeydown);

// --- ATAJOS GLOABLES DEL TECLADO ---
document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        historyManager.undoHistory();
    }
});

window.addEventListener('beforeunload', (e) => {
    if (state.cardsData.length > 0 || textContainer.innerText.trim() !== '') {
        e.preventDefault();
        e.returnValue = '';
    }
});

// --- INICIALIZACIÓN ---
// Autocarga del estado al inicio del módulo
loadFromLocal();
