const API_URL = "https://www.omdbapi.com/";
const API_KEY_STORAGE = "simplifiedFlix.omdbApiKey";
const DEFAULT_API_KEY = "c17ca0b7";

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const apiKeyForm = document.querySelector("#apiKeyForm");
const apiKeyInput = document.querySelector("#apiKeyInput");
const apiKeyPanel = document.querySelector("#apiKeyPanel");
const moviesGrid = document.querySelector("#moviesGrid");
const resultsInfo = document.querySelector("#resultsInfo");
const sortSelect = document.querySelector("#sortSelect");
const typeSelect = document.querySelector("#typeSelect");

let apiKey = localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
let movies = [];
let activeQuery = "";
let requestController;

function updateKeyPanel() {
  apiKeyPanel.classList.toggle("is-connected", Boolean(apiKey));
  apiKeyInput.value = apiKey;
  document.querySelector("#apiKeyTitle").textContent = apiKey ? "OMDb connected" : "Connect to OMDb";
}

function showMessage(title, message, isError = false) {
  moviesGrid.innerHTML = "";
  moviesGrid.setAttribute("aria-busy", "false");
  const wrapper = document.createElement("div");
  wrapper.className = `status-message${isError ? " status-message--error" : ""}`;
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("span");
  detail.textContent = message;
  wrapper.append(heading, detail);
  moviesGrid.append(wrapper);
}

function showLoading() {
  moviesGrid.setAttribute("aria-busy", "true");
  moviesGrid.innerHTML = Array.from({ length: 8 }, () => `
    <article class="movie-card movie-card--skeleton" aria-hidden="true">
      <div class="movie-card__img--skeleton"></div>
      <div class="movie-card__title--skeleton"></div>
      <div class="movie-card__year--skeleton"></div>
    </article>`).join("");
}

function getYear(movie) {
  const match = String(movie.Year || "").match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function renderMovies() {
  const selectedType = typeSelect.value;
  const visibleMovies = movies.filter((movie) => selectedType === "all" || movie.Type === selectedType);
  const sortOrder = sortSelect.value;

  if (sortOrder === "a-z") visibleMovies.sort((a, b) => a.Title.localeCompare(b.Title));
  if (sortOrder === "z-a") visibleMovies.sort((a, b) => b.Title.localeCompare(a.Title));
  if (sortOrder === "newest") visibleMovies.sort((a, b) => getYear(b) - getYear(a) || a.Title.localeCompare(b.Title));
  if (sortOrder === "oldest") visibleMovies.sort((a, b) => getYear(a) - getYear(b) || a.Title.localeCompare(b.Title));

  resultsInfo.textContent = `${visibleMovies.length} ${visibleMovies.length === 1 ? "result" : "results"} for “${activeQuery}”`;
  moviesGrid.setAttribute("aria-busy", "false");
  if (!visibleMovies.length) {
    showMessage("No matches for this filter", "Try another type or choose a different search.");
    return;
  }

  moviesGrid.innerHTML = visibleMovies.map((movie) => {
    const hasPoster = movie.Poster && movie.Poster !== "N/A";
    const poster = hasPoster
      ? `<img class="movie-card__img" src="${escapeAttribute(movie.Poster)}" alt="Poster for ${escapeAttribute(movie.Title)}" loading="lazy" />`
      : `<div class="movie-card__poster-placeholder" role="img" aria-label="Poster not available">Poster<br />not available</div>`;
    return `<article class="movie-card">
      ${poster}
      <h2 class="movie-card__title">${escapeHTML(movie.Title)}</h2>
      <p class="movie-card__year">${escapeHTML(movie.Year)}</p>
      <p class="movie-card__type">${escapeHTML(movie.Type || "Movie")}</p>
    </article>`;
  }).join("");

  moviesGrid.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      const placeholder = document.createElement("div");
      placeholder.className = "movie-card__poster-placeholder";
      placeholder.setAttribute("role", "img");
      placeholder.setAttribute("aria-label", "Poster not available");
      placeholder.innerHTML = "Poster<br />not available";
      img.replaceWith(placeholder);
    }, { once: true });
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeAttribute(value = "") {
  return escapeHTML(value);
}

async function searchMovies(query) {
  if (!apiKey) {
    showMessage("Add your OMDb key to begin", "Use the form above to save your free API key, then search again.");
    apiKeyInput.focus();
    return;
  }

  activeQuery = query.trim();
  if (!activeQuery) return;
  requestController?.abort();
  requestController = new AbortController();
  showLoading();
  resultsInfo.textContent = `Searching OMDb for “${activeQuery}”…`;

  try {
    const params = new URLSearchParams({ apikey: apiKey, s: activeQuery, page: "1" });
    const response = await fetch(`${API_URL}?${params}`, { signal: requestController.signal });
    if (!response.ok) throw new Error(`OMDb returned an HTTP error (${response.status}).`);
    const data = await response.json();
    if (data.Response === "False") {
      movies = [];
      resultsInfo.textContent = "No results";
      const badKey = /invalid api key/i.test(data.Error || "");
      if (badKey) {
        localStorage.removeItem(API_KEY_STORAGE);
        apiKey = "";
        updateKeyPanel();
        showMessage("That API key was not accepted", "Check the key and save it again.", true);
      } else {
        showMessage("No movies found", data.Error || "Try another search term.");
      }
      return;
    }
    movies = data.Search || [];
    renderMovies();
  } catch (error) {
    if (error.name === "AbortError") return;
    resultsInfo.textContent = "Search failed";
    showMessage("Couldn’t reach OMDb", "Check your internet connection and API key, then try again.", true);
  }
}

apiKeyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  apiKey = apiKeyInput.value.trim();
  if (!apiKey) return;
  localStorage.setItem(API_KEY_STORAGE, apiKey);
  updateKeyPanel();
  if (searchInput.value.trim()) searchMovies(searchInput.value);
  else searchInput.focus();
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchMovies(searchInput.value);
});

sortSelect.addEventListener("change", renderMovies);
typeSelect.addEventListener("change", renderMovies);
updateKeyPanel();
if (apiKey) showMessage("Ready when you are", "Search for a movie or series above.");
else showMessage("Add your OMDb key to begin", "Use the form above to save your free API key.");
