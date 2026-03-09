// --- IMPORTANTE: Entorno de Ejecución ---
// Este archivo DEBE abrirse a través de un servidor web local para evitar errores
// de CORS. No funcionará abriendo el HTML haciendo doble clic (file://).

import { state } from './state.js';
import { loadFromLocal, saveToLocal } from './storage.js';
import { renderSidebar, deleteCard, updateGlobalStats, renderFullScript, updateStats } from './ui.js';
import { startPrompter, exitPrompter, openJumpMenu, closeJumpMenu, toggleFontSlider, handlePrompterInput, nextCard, prevCard, handleKeydown, updateFontSize, cycleAlignment, toggleCompleted } from './engine.js';
import { historyManager } from './history-manager.js';

const renderPrompterText = renderFullScript;
function sysDialog({ title = '', message = '', icon = '❓', confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', isAlert = false } = {}) {
    return new Promise(resolve => {
        const overlay = document.getElementById('sys-dialog-overlay');
        document.getElementById('sys-dialog-icon').textContent = icon;
        document.getElementById('sys-dialog-title').textContent = title;
        document.getElementById('sys-dialog-message').innerHTML = message;
        const btnsEl = document.getElementById('sys-dialog-btns');
        btnsEl.innerHTML = '';

        const close = (confirmed) => { overlay.style.display = 'none'; resolve(confirmed); };

        if (!isAlert) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = cancelLabel;
            cancelBtn.style.cssText = 'padding:8px 16px; background:transparent; border:1px solid #555; color:#ccc; border-radius:4px; cursor:pointer; font-weight: normal !important;';
            cancelBtn.onclick = () => close(false);
            btnsEl.appendChild(cancelBtn);
        }

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = confirmLabel;
        confirmBtn.style.cssText = 'padding:8px 16px; background:#b026ff; border:none; color:#fff; border-radius:4px; cursor:pointer; font-weight:bold;';
        confirmBtn.onclick = () => close(true);
        btnsEl.appendChild(confirmBtn);

        overlay.style.display = 'flex';
    });
}

const textContainer = document.getElementById('text-container');
textContainer.setAttribute('contenteditable', 'false');
const cardsList = document.getElementById('cards-list');
const btnStart = document.getElementById('btn-start');
const prompterView = document.getElementById('prompter-view');
const prompterText = document.getElementById('prompter-text');
const fontSliderPanel = document.getElementById('font-slider-panel');
const fontSizeSlider = document.getElementById('font-size-slider');
const jumpMenuOverlay = document.getElementById('jump-menu-overlay');



// --- PERSISTENCIA DE SESIÓN ---
let lastProjectId = localStorage.getItem('prompter_lastProjectId') || '';

let isAutoLoading = false; // true durante restauraciones programáticas (evita confirm)

// --- FUNCIÓN CENTRALIZADA DE RENDERIZADO ---
function updateSpeakerLabel(selected) {
    const label = document.getElementById('speaker-select-label');
    if (!label) return;
    if (selected.length === 0) { label.textContent = 'Selecciona Hablante...'; }
    else if (selected.length === 1) { label.textContent = selected[0]; }
    else if (selected.length <= 3) { label.textContent = selected.join(', '); }
    else { label.textContent = `${selected.length} hablantes seleccionados`; }
}

// --- LISTENERS DE LA MODAL DE HABLANTES ---

// Abrir modal al hacer clic en el trigger
document.getElementById('custom-speaker-select').addEventListener('click', () => {
    document.getElementById('speaker-modal-overlay').style.display = 'flex';
});

// Cerrar modal: botón X
document.getElementById('btn-close-speaker-modal').addEventListener('click', () => {
    document.getElementById('speaker-modal-overlay').style.display = 'none';
});

// Cerrar modal: clic en el overlay (fuera del contenido)
document.getElementById('speaker-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('speaker-modal-overlay')) {
        document.getElementById('speaker-modal-overlay').style.display = 'none';
    }
});

// Delegación: cambio en cualquier checkbox de la modal
document.getElementById('speaker-modal-list').addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const checked = Array.from(
        document.querySelectorAll('#speaker-modal-list input[type=checkbox]:checked')
    ).map(cb => cb.value);

    state.selectedSpeakers = checked;
    updateSpeakerLabel(checked);
    renderFullScript();
});

// --- EVENTOS DEL PANEL PRINCIPAL (SETUP) ---

document.getElementById('btn-undo').addEventListener('click', () => { historyManager.undoHistory(); });
document.getElementById('btn-refresh').addEventListener('click', async () => {
    // Leer hablantes marcados en la modal
    const checked = Array.from(
        document.querySelectorAll('#speaker-modal-list input[type=checkbox]:checked')
    ).map(cb => cb.value);
    if (checked.length === 0) return;

    // Guardarraíl: confirmar borrado de tarjetas actuales
    if (state.cardsData.length > 0) {
        const confirmed = await sysDialog({
            title: '¿Recargar Guion?',
            message: 'Se eliminarán todas las tarjetas y marcas de lectura actuales.',
            confirmLabel: 'Recargar',
            icon: '🔄'
        });
        if (!confirmed) return;
    }

    // Limpieza total del estado (reset a guión limpio sin marks)
    state.cardsData = []; cardsList.innerHTML = ''; state.colorIndex = 0;
    textContainer.innerHTML = '';

    // Re-renderizar como carga limpia
    isAutoLoading = true;
    state.selectedSpeakers = checked;
    renderFullScript();
    isAutoLoading = false;
});
document.getElementById('btn-clear').addEventListener('click', async () => {
    // --- Guardarraíl: confirmar borrado total ---
    if (state.cardsData.length > 0) {
        const confirmed = await sysDialog({
            title: '¿Limpiar Todo?',
            message: 'Borrarás todo el texto actual y la configuración temporal de esta sesión.',
            confirmLabel: 'Borrar Progreso',
            icon: '🗑️'
        });
        if (!confirmed) return;
    }
    state.originalTextContent = '';
    textContainer.innerHTML = '';
    state.cardsData = []; cardsList.innerHTML = ''; state.colorIndex = 0;
    updateGlobalStats();
    localStorage.removeItem('prompterAutosave');
    historyManager.pushHistory();
    state.selectedSpeakers = []; localStorage.setItem('prompter_activeSpeakers', '[]');
    // Resetear modal de hablantes
    const speakerModalListClear = document.getElementById('speaker-modal-list');
    const customSelectClear = document.getElementById('custom-speaker-select');
    if (speakerModalListClear) speakerModalListClear.innerHTML = '';
    document.getElementById('speaker-select-label').textContent = 'Selecciona Hablante...';
    customSelectClear.style.opacity = '0.5';
    customSelectClear.style.pointerEvents = 'none';
});

let rightDebounceTimer;
cardsList.addEventListener('input', (e) => {
    if (e.target.tagName === 'TEXTAREA') {
        const cardItem = e.target.closest('.card-item');
        if (!cardItem) return;
        const cardId = parseInt(cardItem.dataset.id);
        const newText = e.target.value;

        // 1. Actualizar el estado central en memoria
        const cardIndex = state.cardsData.findIndex(c => c.id === cardId);
        if (cardIndex > -1) {
            state.cardsData[cardIndex].text = newText;
        }

        // 2. Reflejar visualmente el cambio en el guion original (Panel Izquierdo)
        const markEl = document.getElementById(`mark-${cardId}`);
        if (markEl) {
            markEl.textContent = newText;
        }

        // 3. Actualizar metadatos de la tarjeta (caracteres y tiempo)
        const timeStr = Math.ceil((newText.trim().split(/\s+/).length / 130) * 60) + "s";
        const statsSpan = e.target.nextElementSibling?.querySelector('span');
        if (statsSpan) statsSpan.textContent = `${newText.length} car. | ~${timeStr}`;

        // 4. Disparar persistencia y métricas globales
        saveToLocal();
        clearTimeout(rightDebounceTimer);
        rightDebounceTimer = setTimeout(() => {
            historyManager.pushHistory();
            updateGlobalStats();
        }, 500);
    }
});

textContainer.addEventListener('mouseup', function () {
    const selection = window.getSelection();
    if (selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    const cardId = Date.now();
    const range = selection.getRangeAt(0);

    // --- BLOQUEO DE COLISIONES (Exclusión Mutua) ---
    const isInsideMark = (node) => {
        if (!node) return false;
        const element = node.nodeType === 3 ? node.parentNode : node;
        return element.closest ? element.closest('mark.highlight') !== null : false;
    };
    const fragment = range.cloneContents();
    const containsMark = fragment.querySelector('mark.highlight') !== null;
    const startInMark = isInsideMark(range.startContainer);
    const endInMark = isInsideMark(range.endContainer);
    if (containsMark || startInMark || endInMark) {
        selection.removeAllRanges();
        console.warn('Bloqueo de colisión: Violación de exclusión mutua en selección.');
        return;
    }

    // 1. Helper: DOM Traversal con closest() — compatible con la nueva estructura de scene-text-block
    const getHeaderFromNode = (node) => {
        const element = node.nodeType === 3 ? node.parentNode : node;
        const sceneBlock = element.closest('.scene-text-block');
        if (sceneBlock) {
            const header = sceneBlock.previousElementSibling;
            if (header && header.getAttribute('contenteditable') === 'false') {
                return header.innerText || header.textContent;
            }
        }
        // Fallback robusto: buscar el último header disponible antes de este punto
        const allHeaders = Array.from(document.querySelectorAll('#text-container div[contenteditable="false"]'));
        for (let i = allHeaders.length - 1; i >= 0; i--) {
            if (allHeaders[i].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
                return allHeaders[i].innerText || allHeaders[i].textContent;
            }
        }
        return allHeaders.length > 0 ? allHeaders[allHeaders.length - 1].innerText : 'TARJETA NUEVA • Sin Metadatos';
    };

    // 2. Escaneo de rango extendido (Origen y Destino)
    let startMeta = getHeaderFromNode(range.startContainer);
    let endMeta = getHeaderFromNode(range.endContainer);

    // 3. Formateo de Salida
    let metaText = startMeta;
    if (startMeta && endMeta && startMeta.trim() !== endMeta.trim()) {
        // Remover "TARJETA " del destino para ser más conciso (ej: "TARJETA #1 ... ➔ #2 ...")
        let cleanEndMeta = endMeta.replace('TARJETA ', '').trim();
        metaText = `${startMeta.trim()} ➔ ${cleanEndMeta}`;
    } else if (!startMeta && endMeta) {
        metaText = endMeta;
    }

    const markNode = document.createElement('mark');
    markNode.className = `highlight c${state.colorIndex % 4}`; markNode.id = `mark-${cardId}`;
    try { markNode.appendChild(range.extractContents()); range.insertNode(markNode); } catch (e) { console.warn("Selección cruzada"); }

    state.cardsData.push({ id: cardId, text: selectedText, metadata: metaText });
    state.colorIndex++; selection.removeAllRanges();

    renderSidebar(); saveToLocal();
    historyManager.pushHistory();
});

textContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'MARK') {
        const cardId = e.target.id.replace('mark-', '');
        const textArea = document.querySelector(`textarea[data-id="${cardId}"]`);
        if (textArea) {
            textArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            textArea.focus();
        }
    }
});

// Delegación de eventos para la lista de tarjetas
cardsList.addEventListener('click', (e) => {
    const btnInsert = e.target.closest('.btn-insert-below');
    if (btnInsert) {
        const cardItem = btnInsert.closest('.card-item');
        const currentId = parseInt(cardItem.dataset.id);
        const currentIndex = state.cardsData.findIndex(c => c.id === currentId);
        if (currentIndex === -1) return;

        const currentMark = document.getElementById(`mark-${currentId}`);
        if (!currentMark) return;

        // 1. Generar nueva tarjeta
        const newId = Date.now();
        const newCard = {
            id: newId,
            text: 'Nueva frase...',
            metadata: state.cardsData[currentIndex].metadata,
            completed: false
        };

        // 2. Inserción Segura en el DOM (Panel Izquierdo)
        const newMark = document.createElement('mark');
        newMark.className = `highlight c${state.colorIndex % 4}`;
        newMark.id = `mark-${newId}`;
        newMark.textContent = newCard.text;
        state.colorIndex++;

        currentMark.after(newMark);
        currentMark.after(document.createTextNode('\n')); // Separador visual

        // 3. Actualizar memoria y UI
        state.cardsData.splice(currentIndex + 1, 0, newCard);
        saveToLocal();
        renderSidebar();
        historyManager.pushHistory();

        // 4. Auto-Focus en la nueva tarjeta creada
        setTimeout(() => {
            const newTextArea = document.querySelector(`textarea[data-id="${newId}"]`);
            if (newTextArea) {
                newTextArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                newTextArea.select();
            }
        }, 50);
    }

    const btnDelete = e.target.closest('.btn-delete');
    if (btnDelete) {
        const cardItem = btnDelete.closest('.card-item');
        if (cardItem) {
            const id = parseInt(cardItem.dataset.id);
            deleteCard(id);
        }
    }

    const btnCheck = e.target.closest('.btn-check');
    if (btnCheck) {
        const cardItem = btnCheck.closest('.card-item');
        if (cardItem) {
            const id = parseInt(cardItem.dataset.id);
            const card = state.cardsData.find(c => c.id === id);
            if (card) {
                card.completed = !card.completed;
                saveToLocal();
                renderSidebar();
                // Si el prompter está activo y estamos en esta tarjeta, sincronizar
                if (prompterView.style.display === 'block' && state.cardsData[state.currentCardIndex]?.id === id) {
                    const btnCompleted = document.getElementById('btn-toggle-completed');
                    if (btnCompleted) {
                        btnCompleted.style.color = card.completed ? '#4caf50' : 'white';
                        btnCompleted.style.borderColor = card.completed ? '#4caf50' : '#555';
                    }
                }
            }
        }
    }
});


// --- EVENTOS DEL PROMPTER ---

btnStart.addEventListener('click', startPrompter);
document.getElementById('btn-exit-prompter').addEventListener('click', (e) => { e.stopPropagation(); exitPrompter(); });
document.getElementById('btn-menu-prompter').addEventListener('click', (e) => { e.stopPropagation(); openJumpMenu(); });
document.getElementById('btn-font-prompter').addEventListener('click', toggleFontSlider);
document.getElementById('btn-align-prompter').addEventListener('click', cycleAlignment);
document.getElementById('btn-toggle-completed').addEventListener('click', toggleCompleted);
prompterView.addEventListener('click', () => { fontSliderPanel.style.display = 'none'; });
fontSliderPanel.addEventListener('click', (e) => e.stopPropagation());
prompterText.addEventListener('input', handlePrompterInput);
document.getElementById('zone-right').addEventListener('click', nextCard);
document.getElementById('zone-left').addEventListener('click', prevCard);
fontSizeSlider.addEventListener('input', updateFontSize);
fontSizeSlider.addEventListener('change', () => { historyManager.pushHistory(); });
document.getElementById('btn-close-jump').addEventListener('click', closeJumpMenu);
jumpMenuOverlay.addEventListener('click', (e) => { if (e.target === jumpMenuOverlay) closeJumpMenu(); });
document.addEventListener('keydown', handleKeydown);

// --- EXPORTACIÓN JSON (💾 btn-save) ---
document.getElementById('btn-save').addEventListener('click', () => {
    if (state.cardsData.length === 0) { sysDialog({ title: 'Exportación fallida', message: 'No hay tarjetas para exportar.', isAlert: true, icon: '❌' }); return; }
    const activeSpeakers = Array.from(
        document.querySelectorAll('#speaker-modal-list input[type=checkbox]:checked')
    ).map(cb => cb.value);
    const payload = {
        timestamp: Date.now(),
        activeSpeakers,
        cards: state.cardsData
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompter_project_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// --- SINCRONIZACIÓN CON BASE DE DATOS (☁️ btn-sync-db) ---


// --- DESCARGAR CAMBIOS (📥 btn-pull-db) ---


// --- SORTING DINÁMICO DE TARJETAS ---
function applyCurrentSorting() {
    const mode = document.getElementById('sidebar-sorter').value;
    if (mode === 'manual') { renderSidebar(); return; }

    if (mode === 'number') {
        state.cardsData.sort((a, b) => {
            const matchA = (a.metadata || '').match(/#(\d+)/);
            const matchB = (b.metadata || '').match(/#(\d+)/);
            return (matchA ? parseInt(matchA[1]) : Infinity) - (matchB ? parseInt(matchB[1]) : Infinity);
        });
    } else if (mode === 'speaker') {
        state.cardsData.sort((a, b) => {
            const getSpeaker = (meta) => {
                const m = (meta || '').match(/🗣️\s*([^\u25ba\n]+)/);
                return m ? m[1].trim() : (meta || '').split('•').slice(-1)[0].trim();
            };
            const getNum = (meta) => { const m = (meta || '').match(/#(\d+)/); return m ? parseInt(m[1]) : Infinity; };
            const spkCmp = getSpeaker(a.metadata).localeCompare(getSpeaker(b.metadata), 'es');
            return spkCmp !== 0 ? spkCmp : getNum(a.metadata) - getNum(b.metadata);
        });
    } else if (mode === 'status') {
        state.cardsData.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
    } else if (mode === 'sync') {
        // 1. Extraer el orden lineal exacto del DOM izquierdo
        const marks = Array.from(document.querySelectorAll('#text-container mark.highlight'));
        const domOrder = marks.map(m => parseInt(m.id.replace('mark-', '')));

        // 2. Ordenar matriz de datos basándose en el índice del DOM
        state.cardsData.sort((a, b) => {
            const indexA = domOrder.indexOf(a.id);
            const indexB = domOrder.indexOf(b.id);

            // Contingencia: Si no existe en el DOM, empujar al final
            const posA = indexA !== -1 ? indexA : Infinity;
            const posB = indexB !== -1 ? indexB : Infinity;

            return posA - posB;
        });
    }
    saveToLocal();
    renderSidebar();
}
document.getElementById('sidebar-sorter').addEventListener('change', applyCurrentSorting);
document.getElementById('btn-refresh-sorter').addEventListener('click', applyCurrentSorting);


// FASE 6.3: Simulador de Ensamblaje Inverso (auditoría de payload sin alterar el DOM)
window.testInverseAssembly = function () {
    const sceneBlocks = document.querySelectorAll('.scene-text-block');
    const payload = [];
    sceneBlocks.forEach(block => {
        const sceneId = block.getAttribute('data-scene-id');
        if (!sceneId) return;
        const clone = block.cloneNode(true);
        clone.querySelectorAll('mark.highlight').forEach(mark => {
            const cleanText = mark.innerText || mark.textContent;
            mark.replaceWith(document.createTextNode(`[${cleanText}]`));
        });
        const finalScript = clone.textContent.replace(/\s+/g, ' ').trim();
        payload.push({ scene_id: sceneId, new_text: finalScript });
    });
    console.log('=== SIMULACIÓN DE PAYLOAD PARA LA BASE DE DATOS ===');
    console.table(payload);
    return payload;
};

// --- ATAJOS GLOBALES DEL TECLADO ---
document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        historyManager.undoHistory();
    }
});

window.addEventListener('beforeunload', (e) => {
    if (state.cardsData.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// --- INICIALIZACIÓN ---
loadFromLocal();   // restaura preferencias de usuario (WPM, fontSize, alignment)

// --- PWA FILE INGESTOR ---
document.getElementById('json-upload-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const importedData = JSON.parse(event.target.result);
            // 1. Cargar Escenas (Metadata de apoyo)
            const rawScenes = (importedData.project && importedData.project.scenes) ? importedData.project.scenes : (importedData.scenes || []);
            state.scenes = Array.isArray(rawScenes) ? rawScenes.map(s => s.scene_data || s) : [];

            // 2. CARGAR TARJETAS (Estructura real del prompter)
            // Priorizamos el array 'cards' que viene en la raíz del JSON
            if (importedData.cards && Array.isArray(importedData.cards) && importedData.cards.length > 0) {
                state.cards = importedData.cards;
                // Sincronizar con cardsData (Panel Lateral)
                state.cardsData = importedData.cards.map(c => ({
                    id: c.id,
                    text: c.text,
                    metadata: c.metadata,
                    completed: c.completed || false
                }));
            } else {
                // Si no hay tarjetas, las generamos a partir de las escenas
                state.cardsData = state.scenes.map((s, idx) => ({
                    id: s.id || Date.now() + idx,
                    text: s.script || "",
                    metadata: `TARJETA #${idx + 1} • ${s.speakerName || 'Hablante'}`,
                    completed: false
                }));
            }


            // 3. Configurar Hablantes y Colores
            if (importedData.project && importedData.project.metadata_config) {
                state.presetColors = importedData.project.metadata_config.colors || [];
                state.presetSpeakers = importedData.project.metadata_config.speakers || [];
                state.selectedSpeakers = state.presetSpeakers.map(s => s.name);
            } else {
                state.selectedSpeakers = [...new Set(state.scenes.map(s => s.speakerName).filter(Boolean))];
            }

            // Destruir bloqueo y renderizar
            const bootScreen = document.getElementById('pwa-boot-screen');
            if (bootScreen) bootScreen.style.display = 'none';

            // Forzar renderizado total de la PWA
            if (typeof renderSidebar === 'function') renderSidebar();
            if (typeof renderFullScript === 'function') renderFullScript();
            if (typeof updateStats === 'function') updateStats();

            // El texto para el modo grabación también se prepara
            if (typeof renderPrompterText === 'function') renderPrompterText();

            console.log(`PWA: ${state.cardsData.length} tarjetas cargadas con éxito.`);

            if (typeof saveToLocal === 'function') saveToLocal();

        } catch (error) {
            console.error("Fallo en la carga PWA:", error);
            alert("Error al procesar JSON. Revisa la consola.");
        }
    };
    reader.readAsText(file);
});

