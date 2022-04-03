import * as msal from "@azure/msal-browser";
import { BlobServiceClient } from "@azure/storage-blob";
import db from './db.json';

const msalConfig = {
    auth: {
        clientId: '53bfecae-5150-4a44-8b5b-957ac4839fa4',
        authority: 'https://login.microsoftonline.com/4583a017-e1c7-4872-bb63-71c8f247fb02'
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);
const myAccounts = msalInstance.getAllAccounts();
const silentRequest = {
    scopes: ["https://storage.azure.com/user_impersonation"],
    account: myAccounts[0],
    forceRefresh: false
};
const request = {
    scopes: ["https://storage.azure.com/user_impersonation"],
    loginHint: myAccounts[0].username
};

// try and get access token silently
msalInstance.acquireTokenSilent(silentRequest).then(tokenResponse => {
    // console.log(tokenResponse);
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has("id")) {
        const showId = urlParams.get("id");
        const showInfo = db[showId];
        document.getElementById("backdrop").style.backgroundImage = showInfo.backdrop_path ? 
            `url(https://image.tmdb.org/t/p/w780/${showInfo.backdrop_path})` : 
            `url(https://image.tmdb.org/t/p/w780/${showInfo.poster_path})`;
        document.getElementById("title").textContent = showInfo.name;
        document.getElementById("tagline").textContent = showInfo.tagline;
        document.getElementById("overview").textContent = showInfo.overview.split(".")[0];
        document.getElementById("total-episodes").textContent = `${showInfo.number_of_episodes} episodes`;
        getEpisodes(tokenResponse.accessToken, showId);

    } else {
        console.error("Show not found");
    }

}).catch(err => {
    console.error(err);
    if(err instanceof msal.InteractionRequiredAuthError) {
        return msalInstance.acquireTokenRedirect(request);
    }
});

const getEpisodes = async (accessToken, showId) => {
    const tokenCredential = {
        getToken() {
            return {
                token: accessToken,
                expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
            };
        }
    };

    const blobServiceClient = new BlobServiceClient("https://azuretv.blob.core.windows.net/", tokenCredential);
    const containerClient = blobServiceClient.getContainerClient("media");
    const episodes = [];

    for await (const item of containerClient.listBlobsByHierarchy("/", { prefix: `TV/${showId}/` })) {
        // console.log(item);
        const blobClient = containerClient.getBlockBlobClient(item.name);
        const meta = (await blobClient.getProperties()).metadata;
        episodes.push({
            season: parseInt(meta.season),
            episode: parseInt(meta.episode),
            blob: item
        });
    }

    episodes.sort((a, b) => {
        if(a.season < b.season) {
            return -1;
        } else if(a.season === b.season) {
            return a.episode - b.episode;
        } else {
            return 1;
        }
    });

    // add series links
    const series = [];
    episodes.forEach(ep => {
        if(series.indexOf(ep.season) === -1) {
            series.push(ep.season);
        }
    });
    
    // addSeriesLinks(series);
    addEpisodes(episodes, showId);
};

const addSeriesLinks = (series) => {
    series.sort().map(seriesNum => {
        const seriesList = document.getElementById("series");
        const seriesItem = document.createElement("li");
        const seriesLink = document.createElement("a");
        seriesLink.href = "#";
        seriesLink.appendChild(seriesItem);
        seriesLink.textContent = `Series ${seriesNum}`;
        seriesItem.appendChild(seriesLink);
        seriesList.appendChild(seriesItem);
    });
};

const addEpisodes = (episodes, showId) => {
    const showInfo = db[showId];
    episodes.forEach(episode => {
        const seasonInfo = showInfo[`season/${episode.season}`];
        const episodeInfo = seasonInfo.episodes[episode.episode - 1];
        // console.log(seasonInfo);
        // console.log(episodeInfo);

        const episodeContainer = document.createElement("div");
        const episodeStill = document.createElement("div");
        episodeContainer.className = "episode";
        episodeStill.className = "episode-still";
        let stillPath = "";
        if(episodeInfo.still_path) {
            stillPath = `https://image.tmdb.org/t/p/w185/${episodeInfo.still_path}`;
        } else if(seasonInfo.poster_path) {
            stillPath = `https://image.tmdb.org/t/p/w185/${seasonInfo.poster_path}`;
        } else {
            stillPath = `https://image.tmdb.org/t/p/w185/${showInfo.poster_path}`;
        }
        episodeStill.style.backgroundImage = `url(${stillPath})`;

        const playButton = document.createElement("button");
        playButton.className = "play-btn";
        playButton.textContent = "▶";
        playButton.addEventListener("click", () => {
            play(episode.blob, episodeInfo, stillPath);
        }, false);
        episodeStill.appendChild(playButton);

        const episodeTitle = document.createElement("p");
        episodeTitle.className = "episode-title";
        episodeTitle.textContent = `Series ${episode.season}: ${episode.episode}. ${episodeInfo.name}`;

        const episodeBio = document.createElement("p");
        episodeBio.textContent = episodeInfo.overview.split(".")[0];
        
        episodeContainer.appendChild(episodeStill);
        episodeContainer.appendChild(episodeTitle);
        episodeContainer.appendChild(episodeBio);
        document.getElementById("episodes").appendChild(episodeContainer);
    });
};

const play = (blob, info, stillPath) => {
    // console.log(blob, info);
    const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    const metadata = new chrome.cast.media.TvShowMediaMetadata();
    metadata.episode = info.episode_number;
    metadata.images = [stillPath];
    metadata.originalAirdate = info.air_date;
    metadata.season = info.season_number;
    metadata.title = info.name;
    const mediaInfo = new chrome.cast.media.MediaInfo(
        `https://azuretv.blob.core.windows.net/media/${blob.name}`,
        blob.properties.contentType);
    mediaInfo.metadata = metadata;
    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    castSession.loadMedia(request)
        .then(() => { 
            console.log('Load succeeded');
        }).catch((err) => {
            console.error('Error code', err);
        });
};