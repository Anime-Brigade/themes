const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const allowcatbox = true;
let URL_LIMIT = 100;
let SLUG_LIMIT = 100;

async function getTheme() {
    let history = await new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, 'history.json'), 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data.trim()));
        });
    });

    let seenAnime = {};
    let totalWeight = 0;

    Object.keys(history.sections).forEach(section => {
        Object.keys(history.sections[section]).forEach(meeting => {
            history.sections[section][meeting].forEach(show => {
                let weight = 0;
                for (let i = 0; i < history.shows[show].themes.length; i++) {
                    weight += 1 / Math.pow(2, i);
                }

                if (!seenAnime[show]) {
                   seenAnime[show] = {};
                    totalWeight += weight * history.shows[show].themes.length;
                }

                history.shows[show].themes.forEach(theme => {
                    if (!seenAnime[show][theme.url]) {
                        let parentSlug = history.shows[show].parent;
                        if (!parentSlug) parentSlug = show;
                        seenAnime[show][theme.url] = {
                            weight: weight,
                            watches: [{
                                section: section,
                                meeting: meeting
                            }],
                            anime: history.shows[show].name,
                            slug: show,
                            parentSlug: parentSlug,
                            theme: theme.name,
                            url: theme.url
                        };
                    } else {
                        seenAnime[show][theme.url].watches.push({
                            section: section,
                            meeting: meeting
                        });
                    }
                });
            });
        });
    });

    let themesList = [];
    Object.keys(seenAnime).forEach(show => {
        Object.keys(seenAnime[show]).forEach(url => {
            themesList.push(seenAnime[show][url]);
        });
    });

    let cantsee = await new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, 'run/cantsee.json'), 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data.trim()));
        });
    });

    URL_LIMIT = themesList.length / 2;
    SLUG_LIMIT = Object.keys(seenAnime).length / 3;

    console.log(themesList.length, 'themes,',
                Object.keys(seenAnime).length, 'anime,',
                cantsee.urls.length, 'urls on cantsee,',
                cantsee.slugs.length, 'slugs on cantsee');

    let retTheme = null

    while(retTheme == null) {
        // select a theme at random
        let position = Math.random() * totalWeight;
        let i = 0;
        while (position > themesList[i].weight) {
            position -= themesList[i].weight;
            i++;
        }

        if(cantsee.urls.includes(themesList[i].url)) {
            console.log("SKIP theme from", themesList[i].slug);
        } else if(cantsee.slugs.includes(themesList[i].slug)) {
            console.log("SKIP slug", themesList[i].slug);
        } else if (!allowcatbox && themesList[i].url.includes("catbox")) {
            console.log("SKIP catbox disabled");
        } else if (history.disabled.includes(themesList[i].slug)) {
            console.log("SKIP disabled entry");
        } else {
            console.log("CHOOSE theme from", themesList[i].slug);
            retTheme = themesList[i];
        }
    }

    cantsee.urls.push(retTheme.url);
    cantsee.slugs.push(retTheme.parentSlug);
    if(cantsee.urls.length > URL_LIMIT) cantsee.urls.shift();
    if(cantsee.slugs.length > SLUG_LIMIT) cantsee.slugs.shift();
    await new Promise((resolve, reject) => {
        fs.writeFile(path.join(__dirname, 'run/cantsee.json'), JSON.stringify(cantsee, null, 4), err => {
            if (err) reject(err);
            else resolve();
        });
    });
    return retTheme;
}

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'themes.html'));
});

router.post('/', async (req, res) => {
    console.log("");
    console.log("getTheme request got!");
    let theme = await getTheme();
    res.send(theme);
});

module.exports = router;
