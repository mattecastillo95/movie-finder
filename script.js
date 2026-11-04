const API_URL = "https://www.omdbapi.com/";
const API_KEY = "c17ca0b7";

const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const moviesGrid = document.querySelector("#moviesGrid");
const resultsInfo = document.querySelector("#resultsInfo");
const sortSelect = document.querySelector("#sortSelect");
const typeSelect = document.querySelector("#typeSelect");

let movies = [];
let activeQuery = "";
let requestController;

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
  moviesGrid.innerHTML = Array.from(
    { length: 8 },
    () => `
    <article class="movie-card movie-card--skeleton" aria-hidden="true">
      <div class="movie-card__img--skeleton"></div>
      <div class="movie-card__title--skeleton"></div>
      <div class="movie-card__year--skeleton"></div>
    </article>`,
  ).join("");
}

function getYear(movie) {
  const match = String(movie.Year || "").match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function renderMovies() {
  const selectedType = typeSelect.value;
  const visibleMovies = movies.filter(
    (movie) => selectedType === "all" || movie.Type === selectedType,
  );
  const sortOrder = sortSelect.value;

  if (sortOrder === "a-z")
    visibleMovies.sort((a, b) => a.Title.localeCompare(b.Title));
  if (sortOrder === "z-a")
    visibleMovies.sort((a, b) => b.Title.localeCompare(a.Title));
  if (sortOrder === "newest")
    visibleMovies.sort(
      (a, b) => getYear(b) - getYear(a) || a.Title.localeCompare(b.Title),
    );
  if (sortOrder === "oldest")
    visibleMovies.sort(
      (a, b) => getYear(a) - getYear(b) || a.Title.localeCompare(b.Title),
    );

  resultsInfo.textContent = `${visibleMovies.length} ${visibleMovies.length === 1 ? "result" : "results"} for “${activeQuery}”`;
  moviesGrid.setAttribute("aria-busy", "false");
  if (!visibleMovies.length) {
    showMessage(
      "No matches for this filter",
      "Try another type or choose a different search.",
    );
    return;
  }

  moviesGrid.innerHTML = visibleMovies
    .map((movie) => {
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
    })
    .join("");

  moviesGrid.querySelectorAll("img").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const placeholder = document.createElement("div");
        placeholder.className = "movie-card__poster-placeholder";
        placeholder.setAttribute("role", "img");
        placeholder.setAttribute("aria-label", "Poster not available");
        placeholder.innerHTML = "Poster<br />not available";
        img.replaceWith(placeholder);
      },
      { once: true },
    );
  });
}

function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

function escapeAttribute(value = "") {
  return escapeHTML(value);
}

async function searchMovies(query) {
  activeQuery = query.trim();
  if (!activeQuery) return;
  requestController?.abort();
  requestController = new AbortController();
  showLoading();
  resultsInfo.textContent = `Searching OMDb for “${activeQuery}”…`;

  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      s: activeQuery,
      page: "1",
    });
    const response = await fetch(`${API_URL}?${params}`, {
      signal: requestController.signal,
    });
    if (!response.ok)
      throw new Error(`OMDb returned an HTTP error (${response.status}).`);
    const data = await response.json();
    if (data.Response === "False") {
      movies = [];
      resultsInfo.textContent = "No results";
      const badKey = /invalid api key/i.test(data.Error || "");
      const message = badKey
        ? "Check the API_KEY value in script.js."
        : data.Error || "Try another search term.";
      showMessage(
        badKey ? "OMDb key was not accepted" : "No movies found",
        message,
        badKey,
      );
      return;
    }
    movies = data.Search || [];
    renderMovies();
  } catch (error) {
    if (error.name === "AbortError") return;
    resultsInfo.textContent = "Search failed";
    showMessage(
      "Couldn’t reach OMDb",
      "Check your internet connection and API key, then try again.",
      true,
    );
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchMovies(searchInput.value);
});

sortSelect.addEventListener("change", renderMovies);
typeSelect.addEventListener("change", renderMovies);
showMessage("Ready when you are", "Search for a movie or series above.");
