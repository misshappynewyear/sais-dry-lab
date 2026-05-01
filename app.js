const DATA_SOURCE = window.GENE_HIT_DATA_SOURCE || "data/gene_hits.csv";
const SIGNIFICANT_P_VALUE = 0.05;
const STRONG_FOLD_CHANGE = 1;
const AUTO_REFRESH_MS = 10000;

const state = {
  genes: [],
  filteredGenes: [],
  selectedGene: null,
  autoRefreshTimer: null
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  autoRefreshInput: document.querySelector("#autoRefreshInput"),
  searchInput: document.querySelector("#searchInput"),
  conditionSelect: document.querySelector("#conditionSelect"),
  pathwaySelect: document.querySelector("#pathwaySelect"),
  statusSelect: document.querySelector("#statusSelect"),
  significantCount: document.querySelector("#significantCount"),
  upCount: document.querySelector("#upCount"),
  downCount: document.querySelector("#downCount"),
  pathwayCount: document.querySelector("#pathwayCount"),
  rowCount: document.querySelector("#rowCount"),
  lastLoaded: document.querySelector("#lastLoaded"),
  geneTableBody: document.querySelector("#geneTableBody"),
  selectedGene: document.querySelector("#selectedGene"),
  selectedDescription: document.querySelector("#selectedDescription"),
  expressionBar: document.querySelector("#expressionBar"),
  detailCondition: document.querySelector("#detailCondition"),
  detailPathway: document.querySelector("#detailPathway"),
  detailBaseMean: document.querySelector("#detailBaseMean"),
  detailNotes: document.querySelector("#detailNotes"),
  pathwayBars: document.querySelector("#pathwayBars")
};

async function loadGenes() {
  const response = await fetch(withCacheBust(DATA_SOURCE));
  if (!response.ok) {
    throw new Error(`Could not load gene data: ${response.status}`);
  }

  const rows = await readRows(response);
  const selectedKey = state.selectedGene ? getGeneKey(state.selectedGene) : "";

  state.genes = rows.map(normalizeGene).sort((a, b) => {
    return Math.abs(b.log2FoldChange) - Math.abs(a.log2FoldChange);
  });

  state.selectedGene = state.genes.find((gene) => getGeneKey(gene) === selectedKey) || state.genes[0] || null;
  elements.lastLoaded.textContent = `loaded ${new Date().toLocaleTimeString()}`;
  populateFilters();
  applyFilters();
}

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}cacheBust=${Date.now()}`;
}

async function readRows(response) {
  const rawText = await response.text();
  const trimmedText = rawText.trim();

  if (trimmedText.startsWith("[") || trimmedText.startsWith("{")) {
    const json = JSON.parse(trimmedText);
    return Array.isArray(json) ? json : json.rows || [];
  }

  return parseCsv(trimmedText);
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function normalizeGene(row) {
  const gene = {
    ...row,
    gene: String(row.gene || "").trim(),
    condition: String(row.condition || "").trim(),
    pathway: String(row.pathway || "").trim(),
    description: String(row.description || "").trim(),
    notes: String(row.notes || "").trim(),
    log2FoldChange: Number(row.log2FoldChange),
    pValue: Number(row.pValue),
    baseMean: Number(row.baseMean)
  };

  gene.status = getStatus(gene);
  return gene;
}

function getGeneKey(gene) {
  return `${gene.gene}|${gene.condition}`;
}

function getStatus(gene) {
  if (gene.pValue >= SIGNIFICANT_P_VALUE || Math.abs(gene.log2FoldChange) < STRONG_FOLD_CHANGE) {
    return "not-significant";
  }

  return gene.log2FoldChange > 0 ? "up" : "down";
}

function populateFilters() {
  fillSelect(elements.conditionSelect, uniqueValues("condition"), "All conditions");
  fillSelect(elements.pathwaySelect, uniqueValues("pathway"), "All pathways");
}

function uniqueValues(field) {
  return [...new Set(state.genes.map((gene) => gene[field]))].sort();
}

function fillSelect(select, values, defaultLabel) {
  const previousValue = select.value;
  select.innerHTML = `<option value="all">${defaultLabel}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });

  if (values.includes(previousValue)) {
    select.value = previousValue;
  }
}

function applyFilters() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  const condition = elements.conditionSelect.value;
  const pathway = elements.pathwaySelect.value;
  const status = elements.statusSelect.value;

  state.filteredGenes = state.genes.filter((gene) => {
    const matchesSearch = gene.gene.toLowerCase().includes(searchTerm);
    const matchesCondition = condition === "all" || gene.condition === condition;
    const matchesPathway = pathway === "all" || gene.pathway === pathway;
    const matchesStatus = status === "all" || gene.status === status;
    return matchesSearch && matchesCondition && matchesPathway && matchesStatus;
  });

  if (!state.filteredGenes.includes(state.selectedGene)) {
    state.selectedGene = state.filteredGenes[0] || null;
  }

  render();
}

function render() {
  renderSummary();
  renderTable();
  renderDetails();
  renderPathways();
}

function renderSummary() {
  const significant = state.filteredGenes.filter((gene) => gene.status !== "not-significant");
  elements.significantCount.textContent = significant.length;
  elements.upCount.textContent = state.filteredGenes.filter((gene) => gene.status === "up").length;
  elements.downCount.textContent = state.filteredGenes.filter((gene) => gene.status === "down").length;
  elements.pathwayCount.textContent = new Set(state.filteredGenes.map((gene) => gene.pathway)).size;
  elements.rowCount.textContent = `${state.filteredGenes.length} rows`;
}

function renderTable() {
  elements.geneTableBody.innerHTML = "";

  state.filteredGenes.forEach((gene) => {
    const row = document.createElement("tr");
    row.className = gene === state.selectedGene ? "selected" : "";
    row.innerHTML = `
      <td><strong>${gene.gene}</strong></td>
      <td>${gene.condition}</td>
      <td>${formatNumber(gene.log2FoldChange)}</td>
      <td>${gene.pValue}</td>
      <td><span class="status ${gene.status}">${formatStatus(gene.status)}</span></td>
      <td>${gene.pathway}</td>
    `;

    row.addEventListener("click", () => {
      state.selectedGene = gene;
      render();
    });

    elements.geneTableBody.append(row);
  });
}

function renderDetails() {
  const gene = state.selectedGene;

  if (!gene) {
    elements.selectedGene.textContent = "No gene selected";
    elements.selectedDescription.textContent = "Try changing the filters.";
    elements.expressionBar.innerHTML = "";
    elements.detailCondition.textContent = "-";
    elements.detailPathway.textContent = "-";
    elements.detailBaseMean.textContent = "-";
    elements.detailNotes.textContent = "-";
    return;
  }

  elements.selectedGene.textContent = gene.gene;
  elements.selectedDescription.textContent = gene.description;
  elements.detailCondition.textContent = gene.condition;
  elements.detailPathway.textContent = gene.pathway;
  elements.detailBaseMean.textContent = gene.baseMean.toLocaleString();
  elements.detailNotes.textContent = gene.notes;
  renderFoldChangeBar(gene);
}

function renderFoldChangeBar(gene) {
  const maxAbsFoldChange = Math.max(3.5, ...state.genes.map((item) => Math.abs(item.log2FoldChange)));
  const width = Math.min(50, Math.abs(gene.log2FoldChange) / maxAbsFoldChange * 50);
  const startsAt = gene.log2FoldChange >= 0 ? 50 : 50 - width;
  const color = gene.log2FoldChange >= 0 ? "var(--up)" : "var(--down)";

  elements.expressionBar.innerHTML = `
    <div class="fold-bar" style="left: ${startsAt}%; width: ${width}%; background: ${color}">
      ${formatNumber(gene.log2FoldChange)}
    </div>
  `;
}

function renderPathways() {
  const counts = state.filteredGenes.reduce((result, gene) => {
    if (gene.status === "not-significant") {
      return result;
    }

    result[gene.pathway] = (result[gene.pathway] || 0) + 1;
    return result;
  }, {});

  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...rows.map((row) => row[1]));
  elements.pathwayBars.innerHTML = "";

  if (rows.length === 0) {
    elements.pathwayBars.textContent = "No significant pathways in the current filter.";
    return;
  }

  rows.forEach(([pathway, count]) => {
    const row = document.createElement("div");
    row.className = "pathway-row";
    row.innerHTML = `
      <strong>${pathway}</strong>
      <div class="pathway-track"><div class="pathway-fill" style="width: ${count / maxCount * 100}%"></div></div>
      <span>${count}</span>
    `;
    elements.pathwayBars.append(row);
  });
}

function formatStatus(status) {
  return status
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function formatNumber(value) {
  return value.toFixed(2);
}

elements.refreshButton.addEventListener("click", refreshGenes);
elements.autoRefreshInput.addEventListener("change", syncAutoRefresh);
elements.searchInput.addEventListener("input", applyFilters);
elements.conditionSelect.addEventListener("change", applyFilters);
elements.pathwaySelect.addEventListener("change", applyFilters);
elements.statusSelect.addEventListener("change", applyFilters);

function syncAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }

  if (elements.autoRefreshInput.checked) {
    state.autoRefreshTimer = setInterval(refreshGenes, AUTO_REFRESH_MS);
  }
}

function refreshGenes() {
  loadGenes().catch((error) => {
    console.error(error);
    elements.lastLoaded.textContent = "load failed";
    elements.geneTableBody.innerHTML = `
      <tr>
        <td colspan="6">Could not load data. Check the data source URL and use a local server.</td>
      </tr>
    `;
  });
}

refreshGenes();
syncAutoRefresh();
