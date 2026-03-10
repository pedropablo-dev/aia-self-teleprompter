import { state } from './state.js';
import { saveToLocal } from './storage.js';
import { historyManager } from './history-manager.js';

const textContainer = document.getElementById('text-container');
const cardsList = document.getElementById('cards-list');
const statsHeader = document.getElementById('global-stats-header');
const statsSidebar = document.getElementById('global-stats-sidebar');
const btnStart = document.getElementById('btn-start');

export function calculateReadingTime(text) { return Math.ceil((text.trim().split(/\s+/).length / state.WPM) * 60); }

const getGroupColor = (str) => {
    if (!str) return '#555555'; // Fallback
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    // Saturación y luminosidad fijas para alto contraste en modo oscuro
    return `hsl(${hue}, 70%, 50%)`;
};

export const updateStats = updateGlobalStats;

export function updateGlobalStats() {
    const fullText = textContainer.innerText || "";
    const tSecsDoc = calculateReadingTime(fullText);
    const minDoc = Math.floor(tSecsDoc / 60); const secDoc = tSecsDoc % 60;
    const timeStrDoc = minDoc > 0 ? `${minDoc}m ${secDoc}s` : `${secDoc}s`;
    statsHeader.textContent = `${fullText.length} car. | ~${timeStrDoc}`;

    let totalCardsWords = 0; let totalCardsChars = 0;
    state.cardsData.forEach(card => { totalCardsChars += card.text.length; totalCardsWords += card.text.trim().split(/\s+/).length; });
    const tSecsCards = Math.ceil((totalCardsWords / state.WPM) * 60);
    const minCards = Math.floor(tSecsCards / 60); const secCards = tSecsCards % 60;
    const timeStrCards = minCards > 0 ? `${minCards}m ${secCards}s` : `${secCards}s`;

    statsSidebar.textContent = `Tarjetas: ${state.cardsData.length} | ${totalCardsChars} car. | ~${timeStrCards}`;
    btnStart.style.display = state.cardsData.length > 0 ? 'block' : 'none';
}

export function renderSidebar() {
    // --- EVALUACIÓN DE ENTROPÍA: Visibilidad dinámica de la opción "Por Hablante" ---
    const uniqueSpeakers = new Set();
    state.cardsData.forEach(card => {
        if (card.metadata && card.metadata.includes('🗣️')) {
            const parts = card.metadata.split('🗣️');
            for (let i = 1; i < parts.length; i++) {
                const speakerName = parts[i].split('➔')[0].trim();
                if (speakerName) uniqueSpeakers.add(speakerName);
            }
        }
    });
    const sorter = document.getElementById('sidebar-sorter');
    const speakerOption = document.querySelector('#sidebar-sorter option[value="speaker"]');
    if (speakerOption && sorter) {
        if (uniqueSpeakers.size > 1) {
            speakerOption.style.display = '';
        } else {
            speakerOption.style.display = 'none';
            if (sorter.value === 'speaker') sorter.value = 'manual';
        }
    }

    cardsList.innerHTML = '';

    // Filtro robusto: si no hay selección, no mostrar nada
    if (!state.selectedSpeakers || state.selectedSpeakers.length === 0) {
        updateGlobalStats();
        return;
    }

    const filteredCards = state.cardsData.filter(card => {
        return state.selectedSpeakers.some(s => card.metadata && card.metadata.includes(s));
    });

    filteredCards.forEach((card, i) => {
        const timeStr = calculateReadingTime(card.text) + "s";
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-item'; cardDiv.dataset.id = card.id;

        // --- Agrupación Visual Inteligente de Tarjetas ---
        const currentMeta = card.metadata || '';
        const prevMeta = i > 0 ? state.cardsData[i - 1].metadata : null;
        const nextMeta = i < state.cardsData.length - 1 ? state.cardsData[i + 1].metadata : null;

        const groupColor = getGroupColor(currentMeta);

        // Estilo por defecto: Tarjeta aislada (Borde completo del color del grupo)
        let groupStyles = `margin-bottom: 15px; border: 1px solid ${groupColor}; border-radius: 6px; box-shadow: 0 0 5px ${groupColor}20;`;

        const isSamePrev = currentMeta === prevMeta;
        const isSameNext = currentMeta === nextMeta;

        if (isSamePrev || isSameNext) {
            if (!isSamePrev && isSameNext) {
                // Primera del grupo
                groupStyles = `margin-top: 15px; margin-bottom: 0; border-top: 1px solid ${groupColor}; border-left: 1px solid ${groupColor}; border-right: 1px solid ${groupColor}; border-bottom: none; border-radius: 6px 6px 0 0; padding-bottom: 8px;`;
            } else if (isSamePrev && !isSameNext) {
                // Última del grupo
                groupStyles = `margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid ${groupColor}; border-left: 1px solid ${groupColor}; border-right: 1px solid ${groupColor}; border-top: none; border-radius: 0 0 6px 6px; padding-top: 8px;`;
            } else {
                // En medio del grupo
                groupStyles = `margin-top: 0; margin-bottom: 0; border-left: 1px solid ${groupColor}; border-right: 1px solid ${groupColor}; border-top: none; border-bottom: none; border-radius: 0; padding-top: 8px; padding-bottom: 8px;`;
            }
        }
        cardDiv.style.cssText = groupStyles;

        const metaText = card.metadata || 'Tarjeta sin metadatos';
        const styledMeta = metaText.replace(/(TARJETA #[0-9]+|➔ #[0-9]+)/g, '<span style="color: #b026ff; font-weight: normal;">$1</span>');
        const metaHtml = `<div class="card-meta-text" style="font-size:0.75rem; color:#888; padding:4px 6px; background:var(--bg-card); border-bottom:1px solid #333; margin-top:-2px; display:flex; align-items:center; gap:8px;" title="${metaText}">
            <span class="drag-handle" style="cursor: grab; font-size: 16px; color: #777; user-select: none; padding: 2px; touch-action: none;" title="Arrastrar tarjeta">⋮⋮</span>
            <span style="flex-grow: 1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${styledMeta}</span>
            <span class="focus-indicator" style="opacity: 0; transition: opacity 0.2s; color: #b026ff; font-size: 0.8rem; font-weight: bold; pointer-events: none;">✍️ EDITANDO</span>
        </div>`;

        const checkClass = card.completed ? 'btn-check completed' : 'btn-check';
        const checkStyle = card.completed
            ? 'color: #4caf50; border: 2px solid #4caf50; background: transparent; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; padding: 0;'
            : 'color: #555; border: 2px solid #555; background: transparent; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; padding: 0;';

        const modClass = card.modified ? 'btn-mod modified' : 'btn-mod';
        const modStyle = card.modified
            ? 'color: #ff9800; border: 2px solid #ff9800; background: transparent; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; padding: 0; font-size: 14px;'
            : 'color: #555; border: 2px solid #555; background: transparent; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; padding: 0; font-size: 14px;';

        cardDiv.innerHTML = `${metaHtml}<textarea id="card-txt-${card.id}" name="card-txt-${card.id}" data-id="${card.id}" spellcheck="false" rows="3" style="height: auto; min-height: 3.5rem; overflow: hidden;">${card.text}</textarea>
        <div class="card-meta">
            <span>${card.text.length} car. | ~${timeStr}</span>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="${checkClass}" data-id="${card.id}" style="${checkStyle}" title="Marcar como completado">✓</button>
                <button class="${modClass}" data-id="${card.id}" style="${modStyle}" title="Marcar/Desmarcar como modificado">✎</button>
                <button class="btn-insert-below" style="background:transparent; border:1px solid #4caf50; color:#4caf50; cursor:pointer; padding:0 10px; border-radius:4px; font-size:0.75rem; height: 28px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; transition: all 0.2s;" title="Añadir tarjeta debajo">↳ Añadir</button>
                <button class="btn-delete" style="padding:0 10px; height: 28px; font-size:0.75rem; font-weight: normal !important; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">Eliminar</button>
            </div>
        </div>`;
        cardDiv.addEventListener('dragstart', (e) => { state.draggedCardId = card.id; e.dataTransfer.effectAllowed = 'move'; });
        cardDiv.addEventListener('dragend', () => { cardDiv.draggable = false; });
        cardDiv.addEventListener('dragover', (e) => { e.preventDefault(); cardDiv.classList.add('drag-over'); });
        cardDiv.addEventListener('dragleave', () => cardDiv.classList.remove('drag-over'));
        cardDiv.addEventListener('drop', (e) => {
            e.preventDefault(); cardDiv.classList.remove('drag-over');
            const targetId = card.id; if (state.draggedCardId && state.draggedCardId !== targetId) swapCards(state.draggedCardId, targetId);
        });
        cardsList.appendChild(cardDiv);

        // Activación dinámica del arrastre exclusivamente desde el handle
        const dragHandle = cardDiv.querySelector('.drag-handle');
        if (dragHandle) {
            const enableDrag = () => { cardDiv.draggable = true; };
            const disableDrag = () => { cardDiv.draggable = false; };
            dragHandle.addEventListener('mousedown', enableDrag);
            dragHandle.addEventListener('touchstart', enableDrag, { passive: true });
            dragHandle.addEventListener('mouseup', disableDrag);
            dragHandle.addEventListener('touchend', disableDrag);
            dragHandle.addEventListener('mouseleave', disableDrag);
        }
    });
    updateGlobalStats();

    let cardDebounceTimer;
    document.querySelectorAll('.card-item textarea').forEach(textarea => {
        // Altura inicial
        textarea.style.height = 'auto';
        if (textarea.scrollHeight > 0) {
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }

        // Altura y estado dinámico en input
        textarea.addEventListener('input', function (e) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const cardIndex = state.cardsData.findIndex(c => c.id === id);
            if (cardIndex > -1) {
                state.cardsData[cardIndex].text = e.target.value;
                if (!state.cardsData[cardIndex].modified) {
                    state.cardsData[cardIndex].modified = true;
                    const modBtn = e.target.nextElementSibling?.querySelector('.btn-mod');
                    if (modBtn) {
                        modBtn.className = 'btn-mod modified';
                        modBtn.style.color = '#ff9800';
                        modBtn.style.borderColor = '#ff9800';
                    }
                }
                const timeStr = calculateReadingTime(e.target.value) + "s";
                e.target.nextElementSibling.querySelector('span').textContent = `${e.target.value.length} car. | ~${timeStr}`;
                const markNode = document.getElementById(`mark-${id}`);
                if (markNode) markNode.innerText = e.target.value;
                updateGlobalStats(); saveToLocal();

                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight) + 'px';

                clearTimeout(cardDebounceTimer);
                cardDebounceTimer = setTimeout(() => { historyManager.pushHistory(); }, 500);
            }
        });
    });

    // Intercepción de evento para el botón modificado manual
    document.querySelectorAll('.btn-mod').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation(); e.preventDefault();
            const id = parseInt(this.getAttribute('data-id'));
            const card = state.cardsData.find(c => c.id === id);
            if (card) {
                card.modified = !card.modified;
                saveToLocal();
                renderSidebar();
            }
        });
    });

    // Intercepción de evento para el botón check (aislando la fuga del Drag & Drop)
    document.querySelectorAll('.btn-check').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            const id = parseInt(this.getAttribute('data-id'));
            const card = state.cardsData.find(c => c.id === id);
            if (card) {
                card.completed = !card.completed;
                saveToLocal();
                renderSidebar();

                // Actualizar visual en prompter si está abierto
                const prompterView = document.getElementById('prompter-view');
                if (prompterView && prompterView.style.display === 'block' && state.cardsData[state.currentCardIndex]?.id === id) {
                    const btnCompleted = document.getElementById('btn-toggle-completed');
                    if (btnCompleted) {
                        btnCompleted.style.color = card.completed ? '#4caf50' : 'white';
                        btnCompleted.style.borderColor = card.completed ? '#4caf50' : '#555';
                    }
                }
            }
        });
    });
} // Fin de renderSidebar cerrado correctamente

export function deleteCard(id) {
    state.cardsData = state.cardsData.filter(c => c.id !== id);
    const markNode = document.getElementById(`mark-${id}`);
    if (markNode) { const textNode = document.createTextNode(markNode.innerText); markNode.replaceWith(textNode); }
    renderSidebar(); saveToLocal();
    historyManager.pushHistory();
}

export function swapCards(idA, idB) {
    const indexA = state.cardsData.findIndex(c => c.id === idA);
    const indexB = state.cardsData.findIndex(c => c.id === idB);
    const tempCard = state.cardsData[indexA];
    state.cardsData[indexA] = state.cardsData[indexB];
    state.cardsData[indexB] = tempCard;

    const sorter = document.getElementById('sidebar-sorter');
    if (sorter) sorter.value = 'manual';
    renderSidebar();
    saveToLocal();
    historyManager.pushHistory();
}

export function renderFullScript() {
    const selectedSpeakers = state.selectedSpeakers || [];
    const allScenes = state.scenes || [];
    let newHtml = '';

    if (selectedSpeakers.length === 0) {
        textContainer.innerHTML = '<div style="color:#555; font-style:italic; padding:20px;">Selecciona al menos un hablante para ver el guion...</div>';
        return;
    }

    allScenes.forEach((scene) => {
        const sceneSpeakerName = scene.speakerName || (scene.scene_data && scene.scene_data.speakerName) || '';
        if (selectedSpeakers.length > 0 && !selectedSpeakers.includes(sceneSpeakerName)) return;

        const scriptText = scene.script || (scene.scene_data && scene.scene_data.script) || '';
        if (!scriptText.trim()) return;

        const absoluteIndex = allScenes.indexOf(scene) + 1;
        const titleText = scene.title || (scene.scene_data && scene.scene_data.title) || '';
        const sectionText = scene.sectionName || scene.section || (scene.scene_data && (scene.scene_data.sectionName || scene.scene_data.section)) || '';

        const cardTitle = titleText ? `&nbsp;•&nbsp; ${titleText}` : '';
        const cardSection = sectionText ? `&nbsp;•&nbsp; ${sectionText}` : '';
        const cardSpeaker = sceneSpeakerName ? `&nbsp;•&nbsp; 🗣️ ${sceneSpeakerName}` : '';

        newHtml += `<div contenteditable="false" style="color: #7a7a7a; font-size: 0.8rem; margin-top: 35px; margin-bottom: 10px; user-select: none; border-bottom: 2px solid #333; padding-bottom: 4px; letter-spacing: 0.5px;">`;
        newHtml += `<span style="color: #b026ff;">TARJETA #${absoluteIndex}</span>${cardTitle}${cardSection}${cardSpeaker}`;
        newHtml += `</div>`;

        let bodyHtml = scriptText.trim();

        // Cruzar con tarjetas existentes (highlights)
        state.cardsData.forEach(card => {
            if (bodyHtml.includes(`id="mark-${card.id}"`)) return;
            if (bodyHtml.includes(`>${card.text}</mark>`)) return;
            if (!bodyHtml.includes(card.text)) return;
            const colorClass = `highlight c${state.cardsData.indexOf(card) % 4}`;
            const markHtml = `<mark class="${colorClass}" id="mark-${card.id}">${card.text}</mark>`;
            bodyHtml = bodyHtml.replace(card.text, markHtml);
        });

        newHtml += `<div class="scene-text-block" data-scene-id="${scene.id}" style="display: block;">${bodyHtml}</div><br>`;
    });

    textContainer.innerHTML = newHtml;
    updateGlobalStats();
}
