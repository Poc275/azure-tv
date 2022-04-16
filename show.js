import * as msal from "@azure/msal-browser";
import { BlobServiceClient } from "@azure/storage-blob";
import { TableClient } from "@azure/data-tables";

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

const getTokenCredential = (token) => {
    return {
        getToken() {
            return {
                token: token.accessToken,
                expiresOnTimestamp: (new Date(token.expiresOn).getTime()),
            };
        }
    };
};

// try and get access token silently
msalInstance.acquireTokenSilent(silentRequest).then(async tokenResponse => {
    // console.log(tokenResponse);
    const tableClient = new TableClient("https://azuretv.table.core.windows.net", "azuretv", getTokenCredential(tokenResponse));
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has("id")) {
        const showId = urlParams.get("id");
        const showInfo = await tableClient.getEntity("shows", showId);
        document.getElementById("backdrop").style.backgroundImage = showInfo.backdrop_path ? 
            `url(https://image.tmdb.org/t/p/w780/${showInfo.backdrop_path})` : 
            `url(https://image.tmdb.org/t/p/w780/${showInfo.poster_path})`;
        document.getElementById("title").textContent = showInfo.name;
        document.getElementById("tagline").textContent = showInfo.tagline;
        document.getElementById("overview").textContent = showInfo.overview.split(".")[0];
        document.getElementById("total-episodes").textContent = `${showInfo.number_of_episodes} episodes`;
        getEpisodes(tokenResponse, showId, tableClient);

    } else {
        console.error("Show not found");
    }

}).catch(err => {
    console.error(err);
    if(err instanceof msal.InteractionRequiredAuthError) {
        return msalInstance.acquireTokenRedirect(request);
    }
});

const getEpisodes = async (token, showId, tableClient) => {
    const blobServiceClient = new BlobServiceClient("https://azuretv.blob.core.windows.net/", getTokenCredential(token));
    const containerClient = blobServiceClient.getContainerClient("media");
    const episodes = [];

    for await (const item of containerClient.listBlobsByHierarchy("/", { prefix: `TV/${showId}/` })) {
        // console.log(item);
        const blobClient = containerClient.getBlockBlobClient(item.name);
        const meta = (await blobClient.getProperties()).metadata;
        try {
            const episodeInfo = await tableClient.getEntity("episodes", `${showId}_${meta.season}_${meta.episode}`);
            episodes.push({
                season_number: episodeInfo.season_number,
                episode_number: episodeInfo.episode_number,
                name: episodeInfo.name,
                overview: episodeInfo.overview,
                still_path: episodeInfo.still_path,
                air_date: episodeInfo.air_date,
                blob: item
            });
        } catch(error) {
            console.error(`Could not find information for season ${meta.season}, episode ${meta.episode}: ${error}`);
        }
    }

    episodes.sort((a, b) => {
        if(a.season_number < b.season_number) {
            return -1;
        } else if(a.season_number === b.season_number) {
            return a.episode_number - b.episode_number;
        } else {
            return 1;
        }
    });

    // add series links
    // const series = [];
    // episodes.forEach(ep => {
    //     if(series.indexOf(ep.season) === -1) {
    //         series.push(ep.season);
    //     }
    // });
    // addSeriesLinks(series);

    addEpisodes(episodes);
};

// const addSeriesLinks = (series) => {
//     series.sort().map(seriesNum => {
//         const seriesList = document.getElementById("series");
//         const seriesItem = document.createElement("li");
//         const seriesLink = document.createElement("a");
//         seriesLink.href = "#";
//         seriesLink.appendChild(seriesItem);
//         seriesLink.textContent = `Series ${seriesNum}`;
//         seriesItem.appendChild(seriesLink);
//         seriesList.appendChild(seriesItem);
//     });
// };

const addEpisodes = (episodes) => {
    episodes.forEach(episode => {
        const episodeContainer = document.createElement("div");
        const episodeStill = document.createElement("div");
        episodeContainer.className = "episode";
        episodeStill.className = "episode-still";
        episodeStill.style.backgroundImage = `url(https://image.tmdb.org/t/p/w185/${episode.still_path})`;

        const playButton = document.createElement("button");
        playButton.className = "play-btn";
        playButton.textContent = "▶";
        playButton.addEventListener("click", () => {
            play(episode.blob, episode);
        }, false);
        episodeStill.appendChild(playButton);

        const episodeTitle = document.createElement("p");
        episodeTitle.className = "episode-title";
        const titleText = episode.season_number === 0 ? 
            `Extras: ${episode.name}` :
            `Series ${episode.season_number}: ${episode.episode_number}. ${episode.name}`;
        episodeTitle.textContent = titleText;

        const episodeBio = document.createElement("p");
        episodeBio.textContent = episode.overview.split(".")[0];
        
        episodeContainer.appendChild(episodeStill);
        episodeContainer.appendChild(episodeTitle);
        episodeContainer.appendChild(episodeBio);
        document.getElementById("episodes").appendChild(episodeContainer);
    });
};

const play = (blob, info) => {
    // console.log(blob, info);
    const castSession = cast.framework.CastContext.getInstance().getCurrentSession();
    const metadata = new chrome.cast.media.TvShowMediaMetadata();
    metadata.episode = info.episode_number;
    metadata.images = [info.still_path];
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