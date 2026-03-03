import { state } from './state.js';
import { updateGlobalStats, renderSidebar } from './ui-renderer.js';
import { historyManager } from './history-manager.js';

const fileNameDisplay = document.getElementById('file-name-display');
const textContainer = document.getElementById('text-container');
const cardsList = document.getElementById('cards-list');
const autosaveIndicator = document.getElementById('autosave-indicator');

export function saveToLocal() {
    if (!textContainer.innerText.trim() && state.cardsData.length === 0) return;
    const projectData = { fileName: fileNameDisplay.textContent, originalText: state.originalTextContent, currentHtml: textContainer.innerHTML, cards: state.cardsData, colorIndex: state.colorIndex, WPM: state.WPM, fontSize: state.fontSize };
    localStorage.setItem('prompterAutosave', JSON.stringify(projectData));
    autosaveIndicator.style.opacity = '1'; setTimeout(() => { autosaveIndicator.style.opacity = '0'; }, 1500);
}

export function loadFromLocal() {
    const savedData = localStorage.getItem('prompterAutosave');
    if (savedData) {
        try {
            const projectData = JSON.parse(savedData);
            fileNameDisplay.textContent = projectData.fileName || "Proyecto Recuperado";
            state.originalTextContent = projectData.originalText || ""; textContainer.innerHTML = projectData.currentHtml || "";
            state.cardsData = projectData.cards || []; state.colorIndex = projectData.colorIndex || 0;
            state.WPM = projectData.WPM || 130; state.fontSize = projectData.fontSize || 8;
            renderSidebar();
            historyManager.pushHistory();
        } catch (e) { console.warn("No se pudo recuperar el autoguardado."); }
    }
}

export function loadFileContent(file) {
    if (!file) return;
    fileNameDisplay.textContent = file.name;
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
        reader.onload = function (e) {
            try {
                const projectData = JSON.parse(e.target.result);
                state.originalTextContent = projectData.originalText || ""; textContainer.innerHTML = projectData.currentHtml || "";
                state.cardsData = projectData.cards || []; state.colorIndex = projectData.colorIndex || 0;
                state.WPM = projectData.WPM || 130; state.fontSize = projectData.fontSize || 8;
                renderSidebar(); saveToLocal();
                historyManager.pushHistory();
            } catch (error) { alert("Archivo corrupto o inválido."); }
        };
    } else {
        reader.onload = function (e) {
            state.originalTextContent = e.target.result; textContainer.textContent = state.originalTextContent;
            state.cardsData = []; cardsList.innerHTML = ''; state.colorIndex = 0; updateGlobalStats(); saveToLocal();
            historyManager.pushHistory();
        };
    }
    reader.readAsText(file);
}
