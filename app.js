import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel } from '@discordjs/voice';
import fetch from 'node-fetch';
import * as fs from 'fs';
import { deleteGuildCommand, installGuildCommand, updateGuildCommand, getGuildCommands } from './commands.js';

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
const MAX_QUEUE_LENGTH = 100;
const MAX_WOWS = 20;
let timer = null;

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
    
	if (interaction.commandName === 'wow') {
        clearTimeout(timer);
        connection = joinVoiceChannel({
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connection.subscribe(player);
        let numWows = interaction.options.getInteger('num_wows');
        numWows = numWows > MAX_WOWS ? MAX_WOWS : numWows;
        const wowResponse = await fetch(`https://owen-wilson-wow-api.herokuapp.com/wows/random?results=${numWows}`);
        const wowData = await wowResponse.json();
        let i = 0;
        for (const wow of wowData) {
            const download = downloadFile(wow.audio, `test${i}.mp3`)

            if ((queue.length > 0 || i > 0) && queue.length < MAX_QUEUE_LENGTH) {
                queue.push(`test${i}.mp3`);
            } else {
                await download;
                const resource = createAudioResource(`test${i}.mp3`, {
                    metadata: {
                        title: 'A good song!',
                    },
                });
                player.play(resource);
            }
            i++;
        }
        const wowPlaying = wowData.map((d, i) => `${i + 1}. "${d.full_line}" ~ ${d.character} (${d.movie})`)
		await interaction.reply('Wow Playing:\n' + wowPlaying.join('\n'));
	}
});

// wow remix - https://www.youtube.com/watch?v=-7r1aeyhTYo

// ambient wow - slow down 1000x like the Justin bieber slowed down
// https://soundcloud.com/mesiuepiescha/justin-bieber-u-smile-slowed-down-800?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing

player.on(AudioPlayerStatus.Idle, () => {
    if (queue.length > 0) {
        const filename = queue.shift();
        const resource = createAudioResource(filename, {
            metadata: {
                title: 'A good song!',
            },
        });
        player.play(resource);
    } else {
        timer = setTimeout(() => {
            player?.stop();
            connection?.destroy();
        }, 1000 * 30);
    }
});
