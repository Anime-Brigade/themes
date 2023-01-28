const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const allowcatbox = false;
let LIMIT = 100;

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
                    weight += 1 / (i + 1);
                }

                if (!seenAnime[show]) {
                   seenAnime[show] = {};
                    totalWeight += weight * history.shows[show].themes.length;
                }

                history.shows[show].themes.forEach(theme => {
                    if (!seenAnime[show][theme.url]) {
                        seenAnime[show][theme.url] = {
                            weight: weight,
                            watches: [{
                                section: section,
                                meeting: meeting
                            }],
                            anime: history.shows[show].name,
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

    console.log(themesList.length, 'themes,', cantsee.length, 'blacklisted');

    let retTheme = null

    while(retTheme == null) {
        // select a theme at random
        let position = Math.random() * totalWeight;
        let i = 0;
        while (position > themesList[i].weight) {
            position -= themesList[i].weight;
            i++;
        }

        if(cantsee.includes(themesList[i].url)) {
            console.log("COLLISION: retry!");
        } else if (!allowcatbox && themesList[i].url.includes("catbox")) {
            console.log("catbox disabled, retry!");
        } else {
            retTheme = themesList[i];
        }
    }

    cantsee.push(retTheme.url);
    if(cantsee.length > LIMIT) cantsee.shift();
    await new Promise((resolve, reject) => {
        fs.writeFile(path.join(__dirname, 'run/cantsee.json'), JSON.stringify(cantsee), err => {
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
