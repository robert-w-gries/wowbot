import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import fetch from 'node-fetch';
import * as fs from 'fs';
import path from 'node:path';
import { temporaryFile } from 'tempy';
import fsPromises from 'node:fs/promises';
import Fuse from 'fuse.js'
import { deleteGuildCommand, installGuildCommand, updateGuildCommand, getGuildCommands } from './commands.js';

const MUSIC_FOLDER = process.env.MUSIC_FOLDER;
const ALBUMS = {
    dreams: 'MouthDreams',
    moods: 'MouthMoods',
    silence: 'MouthSilence',
    sounds: 'MouthSounds',
};

const ALL_SONGS = [];
Object.values(ALBUMS).forEach((album) => {
    const files = fs.readdirSync(`${MUSIC_FOLDER}\\${album}`);
    const mp3Files = files.filter(file => path.win32.extname(file) === '.mp3').map(path => `${MUSIC_FOLDER}\\${album}\\${path}`);
    ALL_SONGS.push(...mp3Files);
});

const fuse = new Fuse(ALL_SONGS, {  threshold: 0.5 });
const SONGS = {
    wowwow: fuse.search('wow wow')[0].item,
    bees: fuse.search('wow wow')[0].item,
};

const parseOption = (target, str) => {
    if (!str) {
        return null;
    }
    const [arg, ...value] = str.split('=');
    if (value.length === 0 || arg !== target) {
        return;
    }
    return value.join('=');
}

const myArgs = process.argv.slice(2);
const deleteCommands = myArgs.map(arg => parseOption('--delete', arg)).filter(v => !!v);
const installCommands = myArgs.map(arg => parseOption('--install', arg)).filter(v => !!v);
const updateCommands = myArgs.map(arg => parseOption('--update', arg)).filter(v => !!v);

const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
});

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

client.once('ready', async () => {
    // Check if guild commands from commands.json are installed (if not, install them)
    const availableCommands = await getGuildCommands(process.env.APP_ID, process.env.GUILD_ID);
    console.log("Available commands:\n" + Object.keys(availableCommands).join('\n') + '\n');

    deleteCommands.forEach(commandName => {
        if (commandName in availableCommands) {
            deleteGuildCommand(process.env.APP_ID, process.env.GUILD_ID, availableCommands[commandName]);
        }
    });
    installCommands.forEach(commandName => installGuildCommand(process.env.APP_ID, process.env.GUILD_ID, commandName));
    updateCommands.forEach(commandName => {
        if (commandName in availableCommands) {
            updateGuildCommand(process.env.APP_ID, process.env.GUILD_ID, availableCommands[commandName]);
        }
    });
    console.log('Ready!');
});

client.login(process.env.DISCORD_TOKEN);

let connection = null;
const player = createAudioPlayer();
const queue = [];
const MAX_WOWS = 91;
let disconnectTimer = null;
let wowPlayingPath = null;

const linkPlayer = (link) => {
    const tmpPath = temporaryFile();
    const downloadPromise = downloadFile(link, tmpPath);
    return {
        play: async () => {
            await downloadPromise;
            const resource = createAudioResource(tmpPath, {
                metadata: {
                    title: 'Wow!',
                },
            });
            player.play(resource);
            wowPlayingPath = tmpPath;
        }
    }
}

const filePlayer = (path) => {
    return {
        play: () => {
            const resource = createAudioResource(path, {
                metadata: {
                    title: 'Wow!',
                },
            });
            player.play(resource);
        }
    }
}

const getSongs = async (target) => {
    if (target in ALBUMS) {
        const files = await fsPromises.readdir(`${MUSIC_FOLDER}/${ALBUMS[target]}`);
        const mp3Files = files.filter(file => path.win32.extname(file) === '.mp3');
        return mp3Files;
    } else if (target in SONGS) {
        return [SONGS[target]];
    }
    const result = fuse.search(target, {  includeScore: true });
    return result.length > 0 ? [result[0].item] : null;
};

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

    if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
    }

	if (interaction.commandName === 'wow') {
        let numWows = interaction.options.getInteger('num_wows');
        numWows = numWows > MAX_WOWS ? MAX_WOWS : numWows;
        const wowResponse = await fetch(`https://owen-wilson-wow-api.herokuapp.com/wows/random?results=${numWows}`);
        const wowData = await wowResponse.json();
        connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connection.subscribe(player);
        wowData?.forEach((wow, i) => {
            if (queue.length === 0 && i === 0) {
                linkPlayer(wow.audio).play();
            } else {
                queue.push(linkPlayer(wow.audio));
            }
        });
        const wowPlaying = wowData.map((d, i) => `${i + 1}. "${d.full_line}" ~ ${d.character} (${d.movie})`)
		await interaction.reply('Wow Playing:\n' + wowPlaying.join('\n'));
	}

    if (interaction.commandName === 'wowstop') {
        player?.stop();
        connection?.destroy();
        await interaction.reply({ ephemeral: true });
    }

	if (interaction.commandName === 'wowmix') {
        const target = interaction.options.getString('music');
        const paths = await getSongs(target);
        if (!paths) {
            await interaction.reply(`Could not find song '${song}`);
            return;
        }
        connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connection.subscribe(player);
        paths.forEach((path, i) => {
            if (queue.length === 0 && i === 0) {
                filePlayer(path).play();
            } else {
                queue.push(filePlayer(path));
            }
        });
        const wowPlaying = paths.map((p, i) => `${i + 1}. "${p}"`)
		await interaction.reply('Wow Playing:\n' + wowPlaying.join('\n'));
    }
});

// wow remix - https://www.youtube.com/watch?v=-7r1aeyhTYo

// ambient wow - slow down 1000x like the Justin bieber slowed down
// https://soundcloud.com/mesiuepiescha/justin-bieber-u-smile-slowed-down-800?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing

player.on(AudioPlayerStatus.Idle, async () => {
    if (wowPlayingPath) {
        await fsPromises.rm(wowPlayingPath, { force: true });
        wowPlayingPath = null;
    }

    if (queue.length === 0) {
        disconnectTimer = setTimeout(() => {
            player?.stop();
            connection?.destroy();
        }, 1000 * 30);
        return;
    }

    const myPlayer = queue.shift();
    myPlayer.play();
});
