// --- IMPORTANTE: Entorno de Ejecución ---
// Al utilizar <script type="module">, este archivo DEBE abrirse a través de un
// servidor web local (ej. Live Server, python -m http.server) para evitar errores
// de CORS. No funcionará abriendo el HTML haciendo doble clic desde el sistema de archivos (file://).

let cardsData = [];
let currentCardIndex = 0;
let colorIndex = 0;
const WPM = 130;
let draggedCardId = null;
let originalTextContent = "";

const fileInput = document.getElementById('file-input');
const fileNameDisplay = document.getElementById('file-name-display');
const textContainer = document.getElementById('text-container');
const cardsList = document.getElementById('cards-list');
const btnStart = document.getElementById('btn-start');
const statsHeader = document.getElementById('global-stats-header');
const statsSidebar = document.getElementById('global-stats-sidebar');
const setupView = document.getElementById('setup-view');
const prompterView = document.getElementById('prompter-view');
const prompterText = document.getElementById('prompter-text');
const progressIndicator = document.getElementById('progress-indicator');
const fontSizeSlider = document.getElementById('font-size-slider');
const jumpMenuOverlay = document.getElementById('jump-menu-overlay');
const jumpListContent = document.getElementById('jump-list-content');
const autosaveIndicator = document.getElementById('autosave-indicator');
const fontSliderPanel = document.getElementById('font-slider-panel');

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

function saveToLocal() {
    if (!textContainer.innerText.trim() && cardsData.length === 0) return;
    const projectData = { fileName: fileNameDisplay.textContent, originalText: originalTextContent, currentHtml: textContainer.innerHTML, cards: cardsData, colorIndex: colorIndex };
    localStorage.setItem('prompterAutosave', JSON.stringify(projectData));
    autosaveIndicator.style.opacity = '1'; setTimeout(() => { autosaveIndicator.style.opacity = '0'; }, 1500);
}

function loadFromLocal() {
    const savedData = localStorage.getItem('prompterAutosave');
    if (savedData) {
        try {
            const projectData = JSON.parse(savedData);
            fileNameDisplay.textContent = projectData.fileName || "Proyecto Recuperado";
            originalTextContent = projectData.originalText || ""; textContainer.innerHTML = projectData.currentHtml || "";
            cardsData = projectData.cards || []; colorIndex = projectData.colorIndex || 0; renderSidebar();
        } catch (e) { console.warn("No se pudo recuperar el autoguardado."); }
    }
}

function loadFileContent(file) {
    if (!file) return;
    fileNameDisplay.textContent = file.name;
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
        reader.onload = function (e) {
            try {
                const projectData = JSON.parse(e.target.result);
                originalTextContent = projectData.originalText || ""; textContainer.innerHTML = projectData.currentHtml || "";
                cardsData = projectData.cards || []; colorIndex = projectData.colorIndex || 0;
                renderSidebar(); saveToLocal();
            } catch (error) { alert("Archivo corrupto o inválido."); }
        };
    } else {
        reader.onload = function (e) {
            originalTextContent = e.target.result; textContainer.textContent = originalTextContent;
            cardsData = []; cardsList.innerHTML = ''; colorIndex = 0; updateGlobalStats(); saveToLocal();
        };
    }
    reader.readAsText(file);
}

fileInput.addEventListener('change', (e) => loadFileContent(e.target.files[0]));
textContainer.addEventListener('dragover', (e) => { e.preventDefault(); textContainer.classList.add('dragover'); });
textContainer.addEventListener('dragleave', () => textContainer.classList.remove('dragover'));
textContainer.addEventListener('drop', (e) => {
    e.preventDefault(); textContainer.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) loadFileContent(e.dataTransfer.files[0]);
});

document.getElementById('btn-save').addEventListener('click', async () => {
    if (!textContainer.innerText.trim() && cardsData.length === 0) return;
    const projectData = { originalText: originalTextContent, currentHtml: textContainer.innerHTML, cards: cardsData, colorIndex: colorIndex };
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

document.getElementById('btn-undo').addEventListener('click', () => { document.execCommand('undo'); updateGlobalStats(); saveToLocal(); });
document.getElementById('btn-refresh').addEventListener('click', () => { if (originalTextContent) { textContainer.textContent = originalTextContent; cardsData = []; cardsList.innerHTML = ''; colorIndex = 0; updateGlobalStats(); saveToLocal(); } });
document.getElementById('btn-clear').addEventListener('click', () => { originalTextContent = ""; fileInput.value = ""; fileNameDisplay.textContent = "Ningún archivo cargado"; textContainer.textContent = "Arrastra aquí tu archivo .txt o tu proyecto .json para empezar..."; cardsData = []; cardsList.innerHTML = ''; colorIndex = 0; updateGlobalStats(); localStorage.removeItem('prompterAutosave'); });

textContainer.addEventListener('input', () => {
    updateGlobalStats();
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        let node = selection.anchorNode;
        while (node && node !== textContainer) {
            if (node.nodeName === 'MARK' && node.id.startsWith('mark-')) {
                const cardId = parseInt(node.id.replace('mark-', ''));
                const newText = node.innerText;
                const cardIndex = cardsData.findIndex(c => c.id === cardId);
                if (cardIndex > -1) {
                    cardsData[cardIndex].text = newText;
                    const textarea = document.querySelector(`textarea[data-id="${cardId}"]`);
                    if (textarea) {
                        textarea.value = newText;
                        const timeStr = calculateReadingTime(newText) + "s";
                        textarea.nextElementSibling.querySelector('span').textContent = `${newText.length} car. | ~${timeStr}`;
                    }
                }
                break;
            }
            node = node.parentNode;
        }
    }
    saveToLocal();
});

textContainer.addEventListener('mouseup', function () {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const cardId = Date.now();
    const range = selection.getRangeAt(0);
    const markNode = document.createElement('mark');
    markNode.className = `highlight c${colorIndex % 4}`; markNode.id = `mark-${cardId}`;
    try { markNode.appendChild(range.extractContents()); range.insertNode(markNode); } catch (e) { console.warn("Selección cruzada"); }

    cardsData.push({ id: cardId, text: selectedText });
    colorIndex++; selection.removeAllRanges();

    const markElements = Array.from(textContainer.querySelectorAll('mark.highlight'));
    const sortedCards = [];
    markElements.forEach(mark => {
        const id = parseInt(mark.id.replace('mark-', ''));
        const card = cardsData.find(c => c.id === id);
        if (card) sortedCards.push(card);
    });
    cardsData = sortedCards;

    renderSidebar(); saveToLocal();
});

function calculateReadingTime(text) { return Math.ceil((text.trim().split(/\s+/).length / WPM) * 60); }

function updateGlobalStats() {
    const fullText = textContainer.innerText || "";
    const tSecsDoc = calculateReadingTime(fullText);
    const minDoc = Math.floor(tSecsDoc / 60); const secDoc = tSecsDoc % 60;
    const timeStrDoc = minDoc > 0 ? `${minDoc}m ${secDoc}s` : `${secDoc}s`;
    statsHeader.textContent = `${fullText.length} car. | ~${timeStrDoc}`;

    let totalCardsWords = 0; let totalCardsChars = 0;
    cardsData.forEach(card => { totalCardsChars += card.text.length; totalCardsWords += card.text.trim().split(/\s+/).length; });
    const tSecsCards = Math.ceil((totalCardsWords / WPM) * 60);
    const minCards = Math.floor(tSecsCards / 60); const secCards = tSecsCards % 60;
    const timeStrCards = minCards > 0 ? `${minCards}m ${secCards}s` : `${secCards}s`;

    statsSidebar.textContent = `Tarjetas: ${cardsData.length} | ${totalCardsChars} car. | ~${timeStrCards}`;
    btnStart.style.display = cardsData.length > 0 ? 'block' : 'none';
}

function renderSidebar() {
    cardsList.innerHTML = '';
    cardsData.forEach((card) => {
        const timeStr = calculateReadingTime(card.text) + "s";
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-item'; cardDiv.draggable = true; cardDiv.dataset.id = card.id;
        cardDiv.innerHTML = `<textarea data-id="${card.id}" spellcheck="false">${card.text}</textarea><div class="card-meta"><span>${card.text.length} car. | ~${timeStr}</span><button class="btn-delete">Eliminar</button></div>`;

        cardDiv.addEventListener('dragstart', (e) => { draggedCardId = card.id; e.dataTransfer.effectAllowed = 'move'; });
        cardDiv.addEventListener('dragover', (e) => { e.preventDefault(); cardDiv.classList.add('drag-over'); });
        cardDiv.addEventListener('dragleave', () => cardDiv.classList.remove('drag-over'));
        cardDiv.addEventListener('drop', (e) => {
            e.preventDefault(); cardDiv.classList.remove('drag-over');
            const targetId = card.id; if (draggedCardId && draggedCardId !== targetId) swapCards(draggedCardId, targetId);
        });
        cardsList.appendChild(cardDiv);
    });
    updateGlobalStats();

    document.querySelectorAll('.card-item textarea').forEach(textarea => {
        textarea.addEventListener('input', function (e) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const cardIndex = cardsData.findIndex(c => c.id === id);
            if (cardIndex > -1) {
                cardsData[cardIndex].text = e.target.value;
                const timeStr = calculateReadingTime(e.target.value) + "s";
                e.target.nextElementSibling.querySelector('span').textContent = `${e.target.value.length} car. | ~${timeStr}`;
                const markNode = document.getElementById(`mark-${id}`);
                if (markNode) markNode.innerText = e.target.value;
                updateGlobalStats(); saveToLocal();
            }
        });
    });
}

function deleteCard(id) {
    cardsData = cardsData.filter(c => c.id !== id);
    const markNode = document.getElementById(`mark-${id}`);
    if (markNode) { const textNode = document.createTextNode(markNode.innerText); markNode.replaceWith(textNode); }
    renderSidebar(); saveToLocal();
}

function swapCards(idA, idB) {
    const indexA = cardsData.findIndex(c => c.id === idA); const indexB = cardsData.findIndex(c => c.id === idB);
    const tempCard = cardsData[indexA]; cardsData[indexA] = cardsData[indexB]; cardsData[indexB] = tempCard;
    const markA = document.getElementById(`mark-${idA}`); const markB = document.getElementById(`mark-${idB}`);
    if (markA && markB) { const tempNode = document.createTextNode(''); markA.before(tempNode); markB.before(markA); tempNode.replaceWith(markB); }
    renderSidebar(); saveToLocal();
}

// --- FUNCIONES PANTALLA COMPLETA NATIVA ---
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

// --- PROMPTER ---
btnStart.addEventListener('click', () => {
    if (cardsData.length === 0) return;
    enterFullscreen(); // Activamos Fullscreen
    setupView.style.display = 'none'; prompterView.style.display = 'block';
    currentCardIndex = 0; renderPrompterCard();
});

document.getElementById('btn-exit-prompter').addEventListener('click', (e) => { e.stopPropagation(); exitPrompter(); });
document.getElementById('btn-menu-prompter').addEventListener('click', (e) => { e.stopPropagation(); openJumpMenu(); });

// Logica boton de fuente
document.getElementById('btn-font-prompter').addEventListener('click', (e) => {
    e.stopPropagation();
    fontSliderPanel.style.display = fontSliderPanel.style.display === 'flex' ? 'none' : 'flex';
});
prompterView.addEventListener('click', () => { fontSliderPanel.style.display = 'none'; });
fontSliderPanel.addEventListener('click', (e) => e.stopPropagation());

function exitPrompter() {
    exitFullscreenMode(); // Salimos de Fullscreen
    prompterView.style.display = 'none'; setupView.style.display = 'flex'; fontSliderPanel.style.display = 'none';
}

function renderPrompterCard() {
    if (cardsData.length === 0) return;
    prompterText.innerText = cardsData[currentCardIndex].text;
    progressIndicator.textContent = `${currentCardIndex + 1} / ${cardsData.length}`;
}

prompterText.addEventListener('input', function (e) {
    if (cardsData.length === 0) return;
    const newText = e.target.innerText;
    const currentCard = cardsData[currentCardIndex];
    currentCard.text = newText;
    const textarea = document.querySelector(`textarea[data-id="${currentCard.id}"]`);
    if (textarea) {
        textarea.value = newText;
        textarea.nextElementSibling.querySelector('span').textContent = `${newText.length} car. | ~${calculateReadingTime(newText)}s`;
    }
    const markNode = document.getElementById(`mark-${currentCard.id}`);
    if (markNode) markNode.innerText = newText;
    updateGlobalStats(); saveToLocal();
});

function nextCard() { if (currentCardIndex < cardsData.length - 1) { currentCardIndex++; renderPrompterCard(); } }
function prevCard() { if (currentCardIndex > 0) { currentCardIndex--; renderPrompterCard(); } }

document.getElementById('zone-right').addEventListener('click', nextCard);
document.getElementById('zone-left').addEventListener('click', prevCard);
fontSizeSlider.addEventListener('input', (e) => { prompterText.style.fontSize = e.target.value + 'vh'; });

// --- MENÚ DE SALTO ---
function openJumpMenu() {
    jumpListContent.innerHTML = '';
    cardsData.forEach((card, index) => {
        const item = document.createElement('div'); item.className = 'jump-item';
        const previewText = card.text.length > 60 ? card.text.substring(0, 60) + '...' : card.text;
        item.innerHTML = `<div class="jump-num">${index + 1}.</div><div class="jump-text">${previewText}</div>`;
        item.addEventListener('click', () => { currentCardIndex = index; renderPrompterCard(); closeJumpMenu(); });
        jumpListContent.appendChild(item);
    });
    jumpMenuOverlay.style.display = 'flex'; fontSliderPanel.style.display = 'none';
}

function closeJumpMenu() { jumpMenuOverlay.style.display = 'none'; }
document.getElementById('btn-close-jump').addEventListener('click', closeJumpMenu);
jumpMenuOverlay.addEventListener('click', (e) => { if (e.target === jumpMenuOverlay) closeJumpMenu(); });

document.addEventListener('keydown', function (e) {
    if (jumpMenuOverlay.style.display === 'flex') { if (e.key === 'Escape') closeJumpMenu(); return; }
    if (prompterView.style.display !== 'block') return;
    if (document.activeElement === prompterText) { if (e.key === 'Escape') { prompterText.blur(); } return; }

    const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown'];
    const prevKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

    if (nextKeys.includes(e.key)) { e.preventDefault(); nextCard(); }
    else if (prevKeys.includes(e.key)) { e.preventDefault(); prevCard(); }
    else if (e.key === 'Escape') { exitPrompter(); }
});

// Autocarga del estado al inicio del módulo
loadFromLocal();

