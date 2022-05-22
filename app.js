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

// TODO: Typescript
const MUSIC_FOLDER = process.env.MUSIC_FOLDER;
const ARTISTS = {};
const ALBUMS = {};
const SONGS = {};
const SONG_FILE_TYPES = [
    '.mp3',
];

const getFolders = async (dirPath) => (await fsPromises.readdir(dirPath, { withFileTypes: true })).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
const getSongs = async (dirPath) => {
    const files = (await fsPromises.readdir(dirPath, { withFileTypes: true })).filter(dirent => dirent.isFile()).map(dirent => dirent.name);
    return files.filter((file) =>  SONG_FILE_TYPES.includes(path.win32.extname(file)));
};

// TODO: Build up database using sqlite
const artistFolders = await getFolders(MUSIC_FOLDER);
await Promise.all(artistFolders.map(async (artistFolderName) => {
    const artistPath = path.join(MUSIC_FOLDER, artistFolderName);
    const albumFolders = await getFolders(artistPath);
    ARTISTS[artistFolderName] = albumFolders;

    await Promise.all(albumFolders.map(async (albumFolderName) => {
        const albumPath = path.join(artistPath, albumFolderName);
        const songFileNames = await getSongs(albumPath);
        ALBUMS[albumFolderName] = songFileNames;
        songFileNames.forEach((songFileName) => SONGS[songFileName] = path.join(albumPath, songFileName));
    }));
}));

const fuse = new Fuse(Object.keys(SONGS), {  threshold: 0.6 });
const HARDCODED_SONGS = {
    bees: SONGS[fuse.search('vivid memories')[0].item],
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

// TODO: Split out command management to separte 'manage.js' script
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
const player = createAudioPlayer({ behaviors: { noSubscriber: 'pause' }});
let queue = [];
const MAX_WOWS = 91;
const MAX_QUEUE_MESSAGE_LENGTH = 20;
let disconnectTimer = null;

// TODO: Improve player code structure
const downloadPlayer = (link, name = null) => {
    const tmpPath = temporaryFile();
    const downloadPromise = downloadFile(link, tmpPath);
    return {
        name: name ?? `${link}`,
        play: async () => {
            await downloadPromise;
            const resource = createAudioResource(tmpPath, {
                metadata: {
                    title: 'Wow!',
                },
            });
            player.play(resource);
            player.once(AudioPlayerStatus.Idle, async () => {
                await fsPromises.rm(tmpPath, { force: true });
            });
        }
    }
}

// TODO: implement replayGain to normalize audio across played files
const filePlayer = (path, name = null) => {
    return {
        name: name ?? path,
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

const getSongsToPlay = async (target) => {
    if (target in ALBUMS) {
        const files = await fsPromises.readdir(`${MUSIC_FOLDER}/${ALBUMS[target]}`);
        const mp3Files = files.filter(file => path.win32.extname(file) === '.mp3').map(p => path.join(MUSIC_FOLDER, ALBUMS[target], p));
        return mp3Files;
    } else if (target in HARDCODED_SONGS) {
        return [HARDCODED_SONGS[target]];
    }
    const result = fuse.search(target, {  includeScore: true });
    return result.length > 0 ? [SONGS[result[0].item]] : null;
};

// TODO: Improve subcommand parsing + bot responses
client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

    if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
    }

	if (interaction.commandName === 'wowson') {
        let numWows = interaction.options.getInteger('num_wows');
        numWows = numWows > MAX_WOWS ? MAX_WOWS : numWows;
        const wowResponse = await fetch(`https://owen-wilson-wow-api.herokuapp.com/wows/random?results=${numWows}`);
        const wowData = await wowResponse.json();
        wowData?.forEach((wow) => {
            queue.push(downloadPlayer(wow.audio, `"${wow.full_line}" ~ ${wow.character} (${wow.movie})`));
        });
        if (player.state.status !== 'playing' && queue.length > 0) {
            queue[0].play();
        }
        connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connection.subscribe(player);
        const wowPlaying = queue.slice(0, MAX_QUEUE_MESSAGE_LENGTH).map((object, i) => `${i + 1}. ${object.name}`)
		await interaction.reply({ content: 'Wow Playing:\n' + wowPlaying.join('\n'), ephemeral: true });
	}

	if (interaction.commandName === 'wow') {
        const subcommand = interaction.options.getSubcommand();
        if (!subcommand) {
            await interaction.reply({ content: 'Error: Expected subcommand but found none!', ephemeral: true });
            return;
        }
        if (subcommand === 'stop') {
            // TODO: clean up on "stop" and "clear" commands
            queue = [];
            player.stop();
            connection?.destroy();
            await interaction.reply({ content: 'Wow!', ephemeral: true });
            return;
        } else if (subcommand === 'clear') {
            player.stop();
            queue = [];
            await interaction.reply({ content: 'Wow!', ephemeral: true });
            return;
        } else if (subcommand === 'skip') {
            player.stop();
            await interaction.reply({ content: 'Wow!', ephemeral: true });
            return;
        } else if (subcommand === 'pause') {
            player.pause();
            await interaction.reply({ content: 'Wow!', ephemeral: true });
            return;
        } else if (subcommand === 'playskip') {
            queue = [];
            await interaction.reply({ content: 'Wow!', ephemeral: true });
            return;
        } else if (subcommand === 'np') {
            const wowPlaying = queue.slice(0, MAX_QUEUE_MESSAGE_LENGTH).map((object, i) => `${i + 1}. ${object.name}`)
            await interaction.reply({ content: 'Wow Playing:\n' + wowPlaying.join('\n'), ephemeral: true });
            return;
        } else if (subcommand === 'unpause' || (subcommand === 'play' && !interaction.options.getString('music'))) {
            if (player.state.status !== 'paused') {
                await interaction.reply({ content: 'Error: No music currently playing!', ephemeral: true });
                return;
            }
            player.unpause();
            await interaction.reply({ content: 'Wow!', ephemeral: true });
            return;
        }
        const target = interaction.options.getString('music');
        const paths = await getSongsToPlay(target);
        if (!paths) {
            await interaction.reply(`Could not find song or album, '${target}`);
            return;
        }
        paths.forEach(p => {
            queue.push(filePlayer(p));
        });
        connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connection.subscribe(player);
        if (player.state.status !== 'playing' && queue.length > 0) {
            queue[0].play();
        }
        const wowPlaying = queue.slice(0, MAX_QUEUE_MESSAGE_LENGTH).map((object, i) => `${i + 1}. ${object.name}`)
		await interaction.reply({ content: 'Wow Playing:\n' + wowPlaying.join('\n'), ephemeral: true });
    }
});

// wow remix - https://www.youtube.com/watch?v=-7r1aeyhTYo

// ambient wow - slow down 1000x like the Justin bieber slowed down
// https://soundcloud.com/mesiuepiescha/justin-bieber-u-smile-slowed-down-800?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing

player.on(AudioPlayerStatus.Idle, () => {
    queue.shift();

    if (queue.length === 0) {
        disconnectTimer = setTimeout(() => {
            player.stop();
            connection?.destroy();
        }, 1000 * 60);
        return;
    }

    queue[0].play();
});
